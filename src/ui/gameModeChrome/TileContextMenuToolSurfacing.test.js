import { ANIMAL_BY_ID } from '../../game/animalCatalog.mjs';
import { createInitialGameState } from '../../game/simCore.mjs';
import { PLANT_BY_ID } from '../../game/plantCatalog.mjs';
import { EARTHWORM_ITEM_ID } from '../../game/simCore.constants.mjs';
import { getTileContextMenuEntriesForTest } from './tileContextMenuTestHelpers.js';

function tileAt(state, x, y) {
  return state.tiles[y * state.width + x];
}

function findLandTileWithAdjacentWater(state, cardinalOnly = false) {
  const dirs = cardinalOnly
    ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
    : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let i = 0; i < state.tiles.length; i += 1) {
    const land = state.tiles[i];
    if (!land || land.waterType || land.rockType) {
      continue;
    }
    for (const [dx, dy] of dirs) {
      const nx = land.x + dx;
      const ny = land.y + dy;
      if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) {
        continue;
      }
      const water = tileAt(state, nx, ny);
      if (water?.waterType && water.waterFrozen !== true) {
        return { land, water };
      }
    }
  }
  return null;
}

/** Two distinct plant-part item ids from cottontail diet (used as simple-snare bait). */
function twoSimpleSnareBaitItemIds() {
  const diet = ANIMAL_BY_ID.sylvilagus_floridanus?.diet || [];
  const ids = [];
  for (let i = 0; i < diet.length && ids.length < 2; i += 1) {
    const plant = PLANT_BY_ID[diet[i]];
    const part = plant?.parts?.[0];
    const sub = part?.subStages?.[0];
    if (plant?.id && part?.name && sub?.id) {
      ids.push(`${plant.id}:${part.name}:${sub.id}`);
    }
  }
  return ids;
}

function findCardinalAdjacentWaterLandTile(state) {
  return findLandTileWithAdjacentWater(state, true);
}

function addMatureTappableWalnutToTile(state, tile, plantId = 'test_tappable_walnut_ctx') {
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

describe('Tile context menu tool surfacing (headless)', () => {
  test('trap_place_fish_weir appears on adjacent river with weir in inventory', () => {
    const state = createInitialGameState(91001, { width: 24, height: 24 });
    const pair = findLandTileWithAdjacentWater(state);
    expect(pair).not.toBeNull();
    const { land, water } = pair;
    water.waterType = 'river';
    water.waterDepth = 'shallow';
    water.waterCurrentStrength = 0.6;
    water.waterCurrentBand = 'medium';
    water.waterFrozen = false;

    state.actors.player.x = land.x;
    state.actors.player.y = land.y;
    state.actors.player.inventory.stacks = [{ itemId: 'tool:fish_trap_weir', quantity: 1 }];

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: water.x,
      selectedTileY: water.y,
      selectedTileEntity: water,
    });
    const weir = entries.find((e) => e.kind === 'trap_place_fish_weir');
    expect(weir).toBeDefined();
    expect(weir.payload.x).toBe(water.x);
    expect(weir.payload.y).toBe(water.y);
  });

  test('trap_place_snare and trap_place_deadfall appear on adjacent empty land with traps carried', () => {
    const state = createInitialGameState(91002, { width: 24, height: 24 });
    const land = state.tiles.find((t) => t && !t.waterType && !t.rockType);
    expect(land).toBeDefined();
    const adj = state.tiles.find(
      (t) => t && !t.waterType && !t.rockType && Math.abs(t.x - land.x) + Math.abs(t.y - land.y) === 1,
    );
    expect(adj).toBeDefined();
    adj.plantIds = [];

    state.actors.player.x = land.x;
    state.actors.player.y = land.y;
    state.actors.player.inventory.stacks = [
      { itemId: 'tool:simple_snare', quantity: 1 },
      { itemId: 'tool:dead_fall_trap', quantity: 1 },
    ];

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: adj.x,
      selectedTileY: adj.y,
      selectedTileEntity: adj,
    });
    expect(entries.some((e) => e.kind === 'trap_place_snare')).toBe(true);
    expect(entries.some((e) => e.kind === 'trap_place_deadfall')).toBe(true);
  });

  test('auto_rod_place appears on player land tile when adjacent to unfrozen water', () => {
    const state = createInitialGameState(91003, { width: 30, height: 30 });
    const pair = findLandTileWithAdjacentWater(state, true);
    expect(pair).not.toBeNull();
    const { land } = pair;
    land.plantIds = [];
    state.actors.player.x = land.x;
    state.actors.player.y = land.y;
    state.actors.player.inventory.stacks = [{ itemId: 'tool:auto_rod', quantity: 1 }];

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: land.x,
      selectedTileY: land.y,
      selectedTileEntity: land,
    });
    const ar = entries.find((e) => e.kind === 'auto_rod_place');
    expect(ar).toBeDefined();
    expect(ar.payload.x).toBe(land.x);
    expect(ar.payload.y).toBe(land.y);
  });

  test('fish_rod_cast: unbaited plus baited variant when earthworm is carried', () => {
    const state = createInitialGameState(91004, { width: 24, height: 24 });
    const pair = findLandTileWithAdjacentWater(state);
    expect(pair).not.toBeNull();
    const { land, water } = pair;

    state.actors.player.x = land.x;
    state.actors.player.y = land.y;
    state.actors.player.inventory.stacks = [
      { itemId: 'tool:fishing_rod', quantity: 1 },
      { itemId: EARTHWORM_ITEM_ID, quantity: 1 },
    ];

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: water.x,
      selectedTileY: water.y,
      selectedTileEntity: water,
    });
    const casts = entries.filter((e) => e.kind === 'fish_rod_cast');
    expect(casts.length).toBe(2);
    const baited = casts.find((e) => e.payload?.baitItemId === EARTHWORM_ITEM_ID);
    const plain = casts.find((e) => !e.payload?.baitItemId);
    expect(baited).toBeDefined();
    expect(plain).toBeDefined();
  });

  test('trap_bait surfaces one entry per eligible inventory bait (parameterized baitItemId)', () => {
    const [baitA, baitB] = twoSimpleSnareBaitItemIds();
    expect(baitA && baitB && baitA !== baitB).toBe(true);

    const state = createInitialGameState(91005, { width: 20, height: 20 });
    state.actors.player.x = 5;
    state.actors.player.y = 5;
    const x = 6;
    const y = 5;
    const t = tileAt(state, x, y);
    t.simpleSnare = { active: true, baitItemId: null };
    t.deadfallTrap = null;

    state.actors.player.inventory.stacks = [
      { itemId: baitA, quantity: 1 },
      { itemId: baitB, quantity: 1 },
    ];

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: x,
      selectedTileY: y,
      selectedTileEntity: t,
    });
    const baits = entries.filter((e) => e.kind === 'trap_bait');
    expect(baits.length).toBe(2);
    expect(baits.every((b) => b.label.startsWith('Bait snare ('))).toBe(true);
    const ids = new Set(baits.map((e) => e.payload.baitItemId));
    expect(ids.has(baitA)).toBe(true);
    expect(ids.has(baitB)).toBe(true);
  });

  test('leaching_basket_place uses selectedInventoryItemId in payload (parameterized material)', () => {
    const speciesId = 'test_ui_leaching_oak';
    const kernelId = `${speciesId}:acorn_kernel:raw`;
    const prev = PLANT_BY_ID[speciesId];
    PLANT_BY_ID[speciesId] = {
      id: speciesId,
      parts: [
        {
          name: 'acorn_kernel',
          subStages: [
            { id: 'raw', tannin_level: 0.8, craft_tags: [], processing_options: [] },
          ],
        },
      ],
    };

    try {
      const state = createInitialGameState(91006, { width: 24, height: 24 });
      const pair = findLandTileWithAdjacentWater(state);
      expect(pair).not.toBeNull();
      const { land, water } = pair;
      water.waterType = 'river';
      water.waterDepth = 'shallow';
      water.waterFrozen = false;

      state.actors.player.x = land.x;
      state.actors.player.y = land.y;
      state.actors.player.inventory.stacks = [
        { itemId: 'tool:leaching_basket', quantity: 1, footprintW: 2, footprintH: 2 },
        { itemId: kernelId, quantity: 2 },
      ];

      const entries = getTileContextMenuEntriesForTest(state, {
        player: state.actors.player,
        selectedTileX: water.x,
        selectedTileY: water.y,
        selectedTileEntity: water,
        selectedContext: {
          selectedInventoryItemId: kernelId,
          selectedInventoryQuantity: 1,
        },
      });
      const place = entries.find((e) => e.kind === 'leaching_basket_place');
      expect(place).toBeDefined();
      expect(place.payload.itemId).toBe(kernelId);
      expect(place.payload.x).toBe(water.x);
      expect(place.payload.y).toBe(water.y);
      expect(place.payload.quantity).toBe(1);
    } finally {
      if (prev) {
        PLANT_BY_ID[speciesId] = prev;
      } else {
        delete PLANT_BY_ID[speciesId];
      }
    }
  });

  test('waterskin_fill appears when selecting cardinal water with empty waterskin', () => {
    const state = createInitialGameState(91007, { width: 28, height: 28 });
    const pair = findCardinalAdjacentWaterLandTile(state);
    expect(pair).not.toBeNull();
    const { land, water } = pair;
    if (!water.waterType) {
      water.waterType = 'river';
    }
    water.waterDepth = 'shallow';
    water.waterFrozen = false;

    state.actors.player.x = land.x;
    state.actors.player.y = land.y;
    state.actors.player.inventory.stacks = [{ itemId: 'tool:waterskin', quantity: 1 }];

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: water.x,
      selectedTileY: water.y,
      selectedTileEntity: water,
    });
    const fill = entries.find((e) => e.kind === 'waterskin_fill');
    expect(fill).toBeDefined();
  });

  test('water_drink appears on adjacent unfrozen water tile', () => {
    const state = createInitialGameState(91008, { width: 28, height: 28 });
    const pair = findCardinalAdjacentWaterLandTile(state);
    expect(pair).not.toBeNull();
    const { land, water } = pair;
    if (!water.waterType) {
      water.waterType = 'pond';
    }
    water.waterFrozen = false;

    state.actors.player.x = land.x;
    state.actors.player.y = land.y;

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: water.x,
      selectedTileY: water.y,
      selectedTileEntity: water,
    });
    const drink = entries.find((e) => e.kind === 'water_drink');
    expect(drink).toBeDefined();
    expect(drink.payload.x).toBe(water.x);
    expect(drink.payload.y).toBe(water.y);
  });

  test('tap_insert_spout appears on mature tappable tree with knife and carved spout', () => {
    const state = createInitialGameState(91009, { width: 26, height: 26 });
    const land = state.tiles.find((t) => t && !t.waterType && !t.rockType);
    expect(land).toBeDefined();
    land.plantIds = [];
    addMatureTappableWalnutToTile(state, land);

    state.actors.player.x = land.x;
    state.actors.player.y = land.y;
    state.actors.player.inventory.stacks = [
      { itemId: 'tool:flint_knife', quantity: 1 },
      { itemId: 'tool:carved_wooden_spout', quantity: 1 },
    ];

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: land.x,
      selectedTileY: land.y,
      selectedTileEntity: land,
    });
    const tap = entries.find((e) => e.kind === 'tap_insert_spout');
    expect(tap).toBeDefined();
    expect(tap.payload.x).toBe(land.x);
    expect(tap.payload.y).toBe(land.y);
  });

  test('hoe appears on adjacent land tile when hoe is carried', () => {
    const state = createInitialGameState(91010, { width: 22, height: 22 });
    const land = state.tiles.find((t) => t && !t.waterType && !t.rockType);
    expect(land).toBeDefined();
    const adj = state.tiles.find(
      (t) => t && !t.waterType && !t.rockType && Math.abs(t.x - land.x) + Math.abs(t.y - land.y) === 1,
    );
    expect(adj).toBeDefined();
    adj.plantIds = [];

    state.actors.player.x = land.x;
    state.actors.player.y = land.y;
    state.actors.player.inventory.stacks = [{ itemId: 'tool:hoe', quantity: 1 }];

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: adj.x,
      selectedTileY: adj.y,
      selectedTileEntity: adj,
    });
    expect(entries.some((e) => e.kind === 'hoe')).toBe(true);
  });

  test('dig appears on adjacent land tile', () => {
    const state = createInitialGameState(91011, { width: 22, height: 22 });
    const land = state.tiles.find((t) => t && !t.waterType && !t.rockType);
    expect(land).toBeDefined();
    const adj = state.tiles.find(
      (t) => t && !t.waterType && !t.rockType && Math.abs(t.x - land.x) + Math.abs(t.y - land.y) === 1,
    );
    expect(adj).toBeDefined();

    state.actors.player.x = land.x;
    state.actors.player.y = land.y;

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: adj.x,
      selectedTileY: adj.y,
      selectedTileEntity: adj,
    });
    expect(entries.some((e) => e.kind === 'dig')).toBe(true);
  });

  test('harvest lists canopy sub-stage when ladder is in inventory (reach tier)', () => {
    const speciesId = 'test_species_reach_tier_menu';
    const plantId = 'reach_tier_plant_menu';
    const prevSpecies = PLANT_BY_ID[speciesId];
    let state = null;

    PLANT_BY_ID[speciesId] = {
      id: speciesId,
      longevity: 'perennial',
      ageOfMaturity: 1,
      lifeStages: [{ stage: 'mature', size: 8, min_age_days: 0, seasonalWindow: null }],
      parts: [
        {
          name: 'leaf',
          subStages: [
            {
              id: 'canopy_leaf',
              reach_tier: 'canopy',
              harvest_base_ticks: 2,
              harvest_tool_modifiers: {},
              harvest_yield: {
                units_per_action: [1, 1],
                actions_until_depleted: [3, 3],
                ground_action_fraction: 0.34,
              },
            },
          ],
        },
      ],
    };

    try {
      state = createInitialGameState(91012, { width: 22, height: 22 });
      const playerTile = state.tiles.find((t) => t && !t.waterType && !t.rockType);
      expect(playerTile).toBeDefined();

      state.plants[plantId] = {
        id: plantId,
        speciesId,
        age: 80,
        x: playerTile.x,
        y: playerTile.y,
        stageName: 'mature',
        alive: true,
        vitality: 1,
        activeSubStages: [
          {
            partName: 'leaf',
            subStageId: 'canopy_leaf',
            initialActionsRoll: 3,
            initialActionsGround: 1,
            initialActionsElevated: 1,
            initialActionsCanopy: 1,
            remainingActionsGround: 1,
            remainingActionsElevated: 1,
            remainingActionsCanopy: 1,
            remainingActions: 3,
          },
        ],
        source: 'test',
      };
      playerTile.plantIds = [plantId];

      state.actors.player.x = playerTile.x;
      state.actors.player.y = playerTile.y;
      state.actors.player.inventory.stacks = [{ itemId: 'tool:ladder', quantity: 1 }];

      const entries = getTileContextMenuEntriesForTest(state, {
        player: state.actors.player,
        selectedTileX: playerTile.x,
        selectedTileY: playerTile.y,
        selectedTileEntity: playerTile,
      });
      const canopyEntry = entries.find(
        (e) => e.kind === 'harvest' && e.payload?.subStageId === 'canopy_leaf',
      );
      expect(canopyEntry).toBeDefined();
      expect(canopyEntry.payload.plantId).toBe(plantId);
      expect(canopyEntry.payload.partName).toBe('leaf');
      expect(canopyEntry.payload.subStageId).toBe('canopy_leaf');
    } finally {
      if (prevSpecies) {
        PLANT_BY_ID[speciesId] = prevSpecies;
      } else {
        delete PLANT_BY_ID[speciesId];
      }
      if (state?.plants && state.plants[plantId]) {
        delete state.plants[plantId];
      }
    }
  });
});
