import assert from 'node:assert/strict';
import { PLANT_BY_ID, getSeason } from '../../src/game/plantCatalog.mjs';
import { ANIMAL_BY_ID } from '../../src/game/animalCatalog.mjs';
import { ITEM_BY_ID, assertKnownItemId } from '../../src/game/itemCatalog.mjs';
import { GROUND_FUNGUS_BY_ID } from '../../src/game/groundFungusCatalog.mjs';
import {
  applyHarvestAction,
  advanceDay,
  advanceTick,
  canGenerateAnimalZones,
  canGenerateBeehives,
  canGenerateFishPopulations,
  canGenerateMushroomZones,
  canGenerateSquirrelCaches,
  createInitialGameState,
  deserializeGameState,
  generateAnimalZones,
  generateBeehives,
  generateFishPopulations,
  generateGroundFungusZones,
  generateSquirrelCaches,
  getActionTickCost,
  getAllActions,
  getAnimalDensityAtTile,
  getFishDensityAtTile,
  getMetrics,
  getNatureSightOverlayData,
  getNatureSightOverlayOptions,
  previewAction,
  getTileAt,
  serializeGameState,
  validateAction,
} from '../../src/game/simCore.mjs';
import { TECH_RESEARCH_TASK_KIND, TECH_RESEARCHABLE_UNLOCK_KEYS } from '../../src/game/techResearchCatalog.mjs';
import { TOOL_RECIPES } from '../../src/game/simActions.mjs';
import waterGenModule from '../../src/game/waterGen.js';
import { normalizeStackFootprintValueImpl } from '../../src/game/advanceTick/inventory.mjs';

const { __testables: waterGenTestables = {} } = waterGenModule;

const DRAINAGE_ORDER = ['poor', 'moderate', 'well', 'excellent'];
const STABILIZED_STATE_CACHE = new Map();

function unlockAllTechResearchForTests(state) {
  if (!state.techUnlocks || typeof state.techUnlocks !== 'object') {
    state.techUnlocks = {};
  }
  for (const k of TECH_RESEARCHABLE_UNLOCK_KEYS) {
    state.techUnlocks[k] = true;
  }
}

function findToolRecipeIdForUnlock(unlockKey) {
  for (const [recipeId, recipe] of Object.entries(TOOL_RECIPES)) {
    if (recipe?.requiredUnlock === unlockKey) {
      return recipeId;
    }
  }
  return null;
}

function cloneGameStateForTest(state) {
  return deserializeGameState(serializeGameState(state));
}

/** West-of-anchor tile is always in-bounds on the default camp footprint and adjacent to a player on the anchor. */
function seedSugarBoilingStationPlacement(state) {
  const ax = state.camp.anchorX;
  const ay = state.camp.anchorY;
  const prev = state.camp.stationPlacements && typeof state.camp.stationPlacements === 'object'
    ? state.camp.stationPlacements
    : {};
  state.camp.stationPlacements = {
    ...prev,
    sugar_boiling_station: { x: ax - 1, y: ay },
  };
}

function runItemPickupValidationRulesTest() {
  const state = createInitialGameState(5341, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for item_pickup validation');
  const adjacentTile = findAdjacentTileMatching(state, playerTile, (tile) => tile && !tile.rockType);
  assert.ok(adjacentTile, 'test requires adjacent target tile for item_pickup validation');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires far tile for item_pickup range rejection');

  player.x = playerTile.x;
  player.y = playerTile.y;

  const missingItemId = validateAction(state, {
    actorId: 'player',
    kind: 'item_pickup',
    payload: { x: adjacentTile.x, y: adjacentTile.y, quantity: 1 },
  });
  assert.equal(missingItemId.ok, false, 'item_pickup should require payload.itemId');
  assert.equal(missingItemId.code, 'invalid_item_pickup_payload', 'missing itemId should return invalid_item_pickup_payload');

  const invalidQty = validateAction(state, {
    actorId: 'player',
    kind: 'item_pickup',
    payload: { x: adjacentTile.x, y: adjacentTile.y, itemId: 'earthworm', quantity: 0 },
  });
  assert.equal(invalidQty.ok, false, 'item_pickup should reject non-positive quantity');
  assert.equal(invalidQty.code, 'invalid_item_pickup_payload', 'non-positive quantity should return invalid_item_pickup_payload');

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'item_pickup',
    payload: { x: farTile.x, y: farTile.y, itemId: 'earthworm', quantity: 1 },
  });
  assert.equal(farValidation.ok, false, 'item_pickup should reject out-of-range targets');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'out-of-range item_pickup should return interaction_out_of_range');

  const missingStack = validateAction(state, {
    actorId: 'player',
    kind: 'item_pickup',
    payload: { x: adjacentTile.x, y: adjacentTile.y, itemId: 'earthworm', quantity: 1 },
  });
  assert.equal(missingStack.ok, false, 'item_pickup should reject when target tile lacks requested item');
  assert.equal(missingStack.code, 'item_pickup_missing_item', 'missing target stack should return item_pickup_missing_item');

  state.worldItemsByTile = {
    [`${adjacentTile.x},${adjacentTile.y}`]: [
      { itemId: 'earthworm', quantity: 2 },
    ],
  };
  const valid = validateAction(state, {
    actorId: 'player',
    kind: 'item_pickup',
    payload: { x: adjacentTile.x, y: adjacentTile.y, itemId: 'earthworm', quantity: 5 },
  });
  assert.equal(valid.ok, true, 'item_pickup should validate when target tile contains requested item');
  assert.equal(valid.normalizedAction.payload.quantity, 2, 'item_pickup should clamp normalized quantity to available stack quantity');
  assert.equal(valid.normalizedAction.tickCost, 1, 'item_pickup should normalize to 1 tick cost');
}

function runItemPickupRuntimeTransferTest() {
  const state = createInitialGameState(5342, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for item_pickup runtime');
  const adjacentTile = findAdjacentTileMatching(state, playerTile, (tile) => tile && !tile.rockType);
  assert.ok(adjacentTile, 'test requires adjacent target tile for item_pickup runtime');

  player.x = playerTile.x;
  player.y = playerTile.y;
  player.inventory.stacks = [];

  const tileKey = `${adjacentTile.x},${adjacentTile.y}`;
  state.worldItemsByTile = {
    [tileKey]: [
      {
        itemId: 'earthworm',
        quantity: 2,
        freshness: 0.6,
        decayDaysRemaining: 3,
      },
    ],
  };

  const firstPickup = advanceTick(state, {
    actions: [
      {
        actionId: 'item-pickup-first',
        actorId: 'player',
        kind: 'item_pickup',
        payload: { x: adjacentTile.x, y: adjacentTile.y, itemId: 'earthworm', quantity: 1 },
      },
    ],
  });

  const firstStack = firstPickup.actors.player.inventory.stacks.find((entry) => entry.itemId === 'earthworm');
  assert.ok(firstStack, 'item_pickup should transfer item into actor inventory');
  assert.equal(firstStack.quantity, 1, 'item_pickup should transfer requested quantity when available');
  const pickedDecay = Number(firstStack.decayDaysRemaining);
  assert.ok(
    Number.isFinite(pickedDecay) && pickedDecay > 2.9 && pickedDecay <= 3,
    'item_pickup should preserve decayDaysRemaining metadata (tiny decay may apply within the pickup tick)',
  );
  assert.equal(Number(firstPickup.worldItemsByTile[tileKey][0].quantity), 1, 'item_pickup should decrement source world stack quantity');
  assert.equal(firstPickup.actors.player.lastPickup?.itemId, 'earthworm', 'item_pickup should write actor.lastPickup metadata');

  const secondPickup = advanceTick(firstPickup, {
    actions: [
      {
        actionId: 'item-pickup-second',
        actorId: 'player',
        kind: 'item_pickup',
        payload: { x: adjacentTile.x, y: adjacentTile.y, itemId: 'earthworm', quantity: 5 },
      },
    ],
  });

  const secondStack = secondPickup.actors.player.inventory.stacks.find((entry) => entry.itemId === 'earthworm');
  assert.ok(secondStack && secondStack.quantity === 2, 'second item_pickup should collect remaining source quantity');
  assert.equal(secondPickup.worldItemsByTile[tileKey], undefined, 'item_pickup should remove world tile key when stack is exhausted');
}

function runItemDropValidationRulesTest() {
  const state = createInitialGameState(5343, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for item_drop validation');
  const adjacentTile = findAdjacentTileMatching(state, playerTile, (tile) => tile && !tile.rockType);
  assert.ok(adjacentTile, 'test requires adjacent target tile for item_drop validation');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires far tile for item_drop range rejection');

  player.x = playerTile.x;
  player.y = playerTile.y;
  player.inventory.stacks = [{ itemId: 'earthworm', quantity: 2 }];

  const missingItemId = validateAction(state, {
    actorId: 'player',
    kind: 'item_drop',
    payload: { x: adjacentTile.x, y: adjacentTile.y, quantity: 1 },
  });
  assert.equal(missingItemId.ok, false, 'item_drop should require payload.itemId');
  assert.equal(missingItemId.code, 'invalid_item_drop_payload', 'missing itemId should return invalid_item_drop_payload');

  const invalidQty = validateAction(state, {
    actorId: 'player',
    kind: 'item_drop',
    payload: { x: adjacentTile.x, y: adjacentTile.y, itemId: 'earthworm', quantity: 0 },
  });
  assert.equal(invalidQty.ok, false, 'item_drop should reject non-positive quantity');
  assert.equal(invalidQty.code, 'invalid_item_drop_payload', 'non-positive quantity should return invalid_item_drop_payload');

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'item_drop',
    payload: { x: farTile.x, y: farTile.y, itemId: 'earthworm', quantity: 1 },
  });
  assert.equal(farValidation.ok, false, 'item_drop should reject out-of-range targets');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'out-of-range item_drop should return interaction_out_of_range');

  const missingInventory = validateAction(state, {
    actorId: 'player',
    kind: 'item_drop',
    payload: { x: adjacentTile.x, y: adjacentTile.y, itemId: 'cordage', quantity: 1 },
  });
  assert.equal(missingInventory.ok, false, 'item_drop should reject dropping unavailable inventory item');
  assert.equal(missingInventory.code, 'insufficient_item_quantity', 'missing inventory item should return insufficient_item_quantity');

  const valid = validateAction(state, {
    actorId: 'player',
    kind: 'item_drop',
    payload: { x: adjacentTile.x, y: adjacentTile.y, itemId: 'earthworm', quantity: 5 },
  });
  assert.equal(valid.ok, true, 'item_drop should validate with available inventory item');
  assert.equal(valid.normalizedAction.payload.quantity, 2, 'item_drop should clamp normalized quantity to available inventory quantity');
  assert.equal(valid.normalizedAction.tickCost, 1, 'item_drop should normalize to 1 tick cost');
}

function runItemDropRuntimeTransferTest() {
  const state = createInitialGameState(5344, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for item_drop runtime');
  const adjacentTile = findAdjacentTileMatching(state, playerTile, (tile) => tile && !tile.rockType);
  assert.ok(adjacentTile, 'test requires adjacent target tile for item_drop runtime');

  player.x = playerTile.x;
  player.y = playerTile.y;
  player.inventory.stacks = [
    {
      itemId: 'earthworm',
      quantity: 2,
      freshness: 0.75,
      decayDaysRemaining: 2,
    },
  ];

  const dropped = advanceTick(state, {
    actions: [
      {
        actionId: 'item-drop-first',
        actorId: 'player',
        kind: 'item_drop',
        payload: { x: adjacentTile.x, y: adjacentTile.y, itemId: 'earthworm', quantity: 1 },
      },
    ],
  });

  const postDropInv = dropped.actors.player.inventory.stacks.find((entry) => entry.itemId === 'earthworm');
  assert.ok(postDropInv && postDropInv.quantity === 1, 'item_drop should reduce inventory by dropped quantity');
  assert.equal(dropped.actors.player.lastDrop?.itemId, 'earthworm', 'item_drop should write actor.lastDrop metadata');

  const worldStacks = Object.values(dropped.worldItemsByTile || {}).flat();
  const droppedStack = worldStacks.find((entry) => entry.itemId === 'earthworm');
  assert.ok(droppedStack, 'item_drop should place stack into worldItemsByTile');
  assert.equal(Math.floor(Number(droppedStack.quantity) || 0), 1, 'item_drop should add dropped quantity to world stack');
  const dropDecay = Number(droppedStack.decayDaysRemaining);
  assert.ok(
    Number.isFinite(dropDecay) && dropDecay > 1.9 && dropDecay <= 2,
    'item_drop should preserve decayDaysRemaining metadata on dropped stack (tiny decay may apply within the drop tick)',
  );
}

function runItemDropNoWetDryMergeSingleStackTileTest() {
  const state = createInitialGameState(5345, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for item_drop dry/wet merge guard');
  const adjacentTile = findAdjacentTileMatching(state, playerTile, (tile) => tile && !tile.rockType);
  assert.ok(adjacentTile, 'test requires adjacent target tile for item_drop dry/wet merge guard');

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = adjacentTile.x + dx;
      const y = adjacentTile.y + dy;
      if (x < 0 || y < 0 || x >= state.width || y >= state.height) {
        continue;
      }
      const tile = state.tiles[y * state.width + x];
      tile.waterType = null;
      tile.rockType = null;
    }
  }

  player.x = playerTile.x;
  player.y = playerTile.y;
  player.inventory.stacks = [
    {
      itemId: 'test_drop_part',
      quantity: 1,
      dryness: 0,
      footprintW: 1,
      footprintH: 1,
    },
  ];

  const first = advanceTick(state, {
    actions: [
      {
        actionId: 'item-drop-dryness-first',
        actorId: 'player',
        kind: 'item_drop',
        payload: { x: adjacentTile.x, y: adjacentTile.y, itemId: 'test_drop_part', quantity: 1 },
      },
    ],
  });

  const firstDroppedEntries = Object.entries(first.worldItemsByTile || {})
    .map(([tileKey, stacks]) => ({ tileKey, stacks: Array.isArray(stacks) ? stacks : [] }))
    .filter((entry) => entry.stacks.some((stack) => stack?.itemId === 'test_drop_part'));
  assert.equal(firstDroppedEntries.length, 1, 'first item_drop should place one test stack in world items');
  assert.equal(Number(firstDroppedEntries[0].stacks[0].dryness), 0, 'first item_drop should preserve wet dryness metadata');

  first.actors.player.inventory.stacks = [
    {
      itemId: 'test_drop_part',
      quantity: 1,
      dryness: 1,
      footprintW: 1,
      footprintH: 1,
    },
  ];

  const second = advanceTick(first, {
    actions: [
      {
        actionId: 'item-drop-dryness-second',
        actorId: 'player',
        kind: 'item_drop',
        payload: { x: adjacentTile.x, y: adjacentTile.y, itemId: 'test_drop_part', quantity: 1 },
      },
    ],
  });

  const worldEntries = Object.entries(second.worldItemsByTile || {});
  const testItemEntries = worldEntries
    .map(([tileKey, stacks]) => ({ tileKey, stacks: Array.isArray(stacks) ? stacks : [] }))
    .filter((entry) => entry.stacks.some((stack) => stack?.itemId === 'test_drop_part'));

  assert.equal(testItemEntries.length, 2, 'item_drop dry/wet incompatibility should occupy two separate tiles');
  for (const entry of testItemEntries) {
    assert.equal(entry.stacks.length, 1, 'each world tile should contain at most one stack after item_drop');
    assert.equal(entry.stacks[0].itemId, 'test_drop_part', 'dropped stack should preserve itemId');
  }

  const droppedDrynessValues = testItemEntries.map((entry) => Number(entry.stacks[0].dryness)).sort((a, b) => a - b);
  const droppedTotal = testItemEntries.reduce((sum, entry) => sum + (Number(entry.stacks[0]?.quantity) || 0), 0);
  assert.equal(droppedTotal, 2, 'item_drop should preserve total dropped quantity when splitting wet/dry stacks across tiles');
  assert.equal(droppedDrynessValues[0], 0, 'first dropped stack should preserve wet dryness value');
  assert.equal(droppedDrynessValues[1], 1, 'second dropped stack should preserve fully dry dryness value');
}

function runFishRodCastSnapSemanticsTest() {
  const species = ANIMAL_BY_ID.esox_lucius;
  assert.ok(species, 'test requires esox_lucius species data');

  const original = {
    weightRangeGrams: Array.isArray(species.weightRangeGrams) ? [...species.weightRangeGrams] : [800, 5000],
    baseCatchRate: species.baseCatchRate,
    currentSensitivity: species.currentSensitivity,
    seasonModifiers: { ...(species.population?.seasonModifiers || {}) },
  };

  species.weightRangeGrams = [5000, 5000];
  species.baseCatchRate = 1;
  species.currentSensitivity = 0;
  species.population = {
    ...(species.population || {}),
    seasonModifiers: {
      spring: 5,
      summer: 5,
      fall: 5,
      winter: 5,
    },
  };

  let snappedState = null;
  try {
    for (let seed = 500; seed < 900; seed += 1) {
      const state = createInitialGameState(seed, { width: 30, height: 30 });
      const player = state.actors.player;
      const landTile = findCardinalAdjacentWaterLandTile(state);
      if (!landTile) {
        continue;
      }

      const waterTile = findAdjacentTileMatching(state, landTile, (tile) => tile?.waterType && tile.waterFrozen !== true);
      if (!waterTile) {
        continue;
      }

      player.x = landTile.x;
      player.y = landTile.y;
      player.inventory.stacks = [
        { itemId: 'tool:fishing_rod', quantity: 1 },
        { itemId: 'earthworm', quantity: 1 },
        { itemId: 'tool:bone_hook', quantity: 1 },
        { itemId: 'cordage', quantity: 1 },
      ];

      const tileKey = `${waterTile.x},${waterTile.y}`;
      state.fishPopulationsGenerated = true;
      state.fishDensityByTile = {};
      state.fishDensityByTile.esox_lucius = { [tileKey]: 1 };

      const next = advanceTick(state, {
        actions: [
          {
            actionId: `fish-rod-snap-${seed}`,
            actorId: 'player',
            kind: 'fish_rod_cast',
            payload: { tickCost: 20, baitItemId: 'earthworm' },
          },
        ],
      });

      if (next.actors.player.lastFishing?.catchSuccess === true) {
        snappedState = next;
        break;
      }
    }

    assert.ok(snappedState, 'test requires at least one deterministic seed with successful fish_rod_cast catch');
    assert.equal(snappedState.actors.player.lastFishing.lineSnapped, true, 'successful catch should snap line at forced heavy weight');
    assert.equal(
      snappedState.actors.player.inventory.stacks.some((entry) => entry.itemId === 'tool:bone_hook'),
      false,
      'line snap should consume one tool:bone_hook',
    );
    assert.equal(
      snappedState.actors.player.inventory.stacks.some((entry) => entry.itemId === 'cordage'),
      false,
      'line snap should consume one cordage',
    );
  } finally {
    species.weightRangeGrams = original.weightRangeGrams;
    species.baseCatchRate = original.baseCatchRate;
    species.currentSensitivity = original.currentSensitivity;
    species.population = {
      ...(species.population || {}),
      seasonModifiers: original.seasonModifiers,
    };
  }
}

function runAutoRodPlaceAndTrapCheckLifecycleTest() {
  const state = createInitialGameState(5301, { width: 30, height: 30 });
  const player = state.actors.player;
  const placementTile = findCardinalAdjacentWaterLandTile(state);
  assert.ok(placementTile, 'test requires land tile cardinally adjacent to unfrozen water for auto_rod_place');

  player.x = placementTile.x;
  player.y = placementTile.y;
  player.inventory.stacks = [
    { itemId: 'tool:auto_rod', quantity: 1 },
    { itemId: 'earthworm', quantity: 2 },
    { itemId: 'tool:bone_hook', quantity: 1 },
    { itemId: 'cordage', quantity: 1 },
  ];

  const placementValidation = validateAction(state, {
    actorId: 'player',
    kind: 'auto_rod_place',
    payload: { x: placementTile.x, y: placementTile.y },
  });
  assert.equal(placementValidation.ok, true, 'auto_rod_place should validate on eligible placement tile');

  const placed = advanceTick(state, {
    actions: [
      {
        actionId: 'auto-rod-place',
        actorId: 'player',
        kind: 'auto_rod_place',
        payload: { x: placementTile.x, y: placementTile.y },
      },
    ],
  });

  const placedTile = placed.tiles[placementTile.y * placed.width + placementTile.x];
  assert.ok(placedTile.autoRod && placedTile.autoRod.active === true, 'auto_rod_place should persist active autoRod state on tile');
  assert.equal(placedTile.autoRod.state, 'live', 'auto_rod_place should initialize autoRod in live state');

  placedTile.autoRod = {
    ...placedTile.autoRod,
    state: 'triggered_catch',
    baitItemId: null,
    pendingSpeciesIds: ['esox_lucius'],
  };

  const checkAndRebait = advanceTick(placed, {
    actions: [
      {
        actionId: 'auto-rod-check-rebait',
        actorId: 'player',
        kind: 'trap_check',
        payload: { x: placementTile.x, y: placementTile.y, baitItemId: 'earthworm' },
      },
    ],
  });

  const rebaitTile = checkAndRebait.tiles[placementTile.y * checkAndRebait.width + placementTile.x];
  assert.equal(rebaitTile.autoRod.state, 'live', 'trap_check with bait should re-arm autoRod to live');
  assert.equal(rebaitTile.autoRod.baitItemId, 'earthworm', 'trap_check with bait should set autoRod baitItemId');
  assert.deepEqual(rebaitTile.autoRod.pendingSpeciesIds, [], 'trap_check should clear pending autoRod catches after collection');
  assert.equal(
    checkAndRebait.actors.player.inventory.stacks.some((entry) => entry.itemId === 'esox_lucius:fish_carcass'),
    true,
    'trap_check should collect pending autoRod fish as carcass inventory',
  );

  const invalidRepairValidation = validateAction(checkAndRebait, {
    actorId: 'player',
    kind: 'trap_check',
    payload: { x: placementTile.x, y: placementTile.y, repair: true },
  });
  assert.equal(invalidRepairValidation.ok, false, 'trap_check repair should reject non-broken autoRod');
  assert.equal(invalidRepairValidation.code, 'trap_check_invalid_repair_target', 'non-broken repair should return trap_check_invalid_repair_target');

  rebaitTile.autoRod = {
    ...rebaitTile.autoRod,
    state: 'broken',
    baitItemId: null,
    pendingSpeciesIds: [],
  };

  const repaired = advanceTick(checkAndRebait, {
    actions: [
      {
        actionId: 'auto-rod-repair-rebait',
        actorId: 'player',
        kind: 'trap_check',
        payload: { x: placementTile.x, y: placementTile.y, repair: true, baitItemId: 'earthworm' },
      },
    ],
  });

  const repairedTile = repaired.tiles[placementTile.y * repaired.width + placementTile.x];
  assert.equal(repairedTile.autoRod.state, 'live', 'trap_check repair + bait should return broken autoRod to live state');
  assert.equal(repairedTile.autoRod.baitItemId, 'earthworm', 'trap_check repair + bait should re-bait autoRod');
  assert.equal(
    repaired.actors.player.inventory.stacks.some((entry) => entry.itemId === 'tool:bone_hook'),
    false,
    'repairing autoRod should consume one tool:bone_hook',
  );
  assert.equal(
    repaired.actors.player.inventory.stacks.some((entry) => entry.itemId === 'cordage'),
    false,
    'repairing autoRod should consume one cordage',
  );
}

function findAdjacentTileMatching(state, originTile, predicate) {
  if (!originTile || typeof predicate !== 'function') {
    return null;
  }
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const x = originTile.x + dx;
      const y = originTile.y + dy;
      if (x < 0 || y < 0 || x >= state.width || y >= state.height) {
        continue;
      }
      const tile = state.tiles[y * state.width + x];
      if (predicate(tile)) {
        return tile;
      }
    }
  }
  return null;
}

function runTrapTilesBlockPlantGerminationOnTileTest() {
  const state = createInitialGameState(4284, { width: 30, height: 30 });
  const speciesId = Object.keys(PLANT_BY_ID || {})[0];
  assert.ok(speciesId, 'test requires at least one plant species for dormant seed germination checks');

  const species = PLANT_BY_ID[speciesId];
  const season = species?.dispersal?.germination_season;
  assert.ok(typeof season === 'string' && season, 'test requires species with germination season');

  let matchedDay = null;
  for (let day = 1; day <= 40; day += 1) {
    if (getSeason(day) === season) {
      matchedDay = day;
      break;
    }
  }
  assert.ok(Number.isInteger(matchedDay), 'test requires at least one day matching species germination season');
  state.dayOfYear = matchedDay;

  const tile = state.tiles.find((entry) => !entry.waterType && !entry.rockType && entry.plantIds.length === 0);
  assert.ok(tile, 'test requires an empty land tile for trap germination blocking');

  const previousRate = Number(species.dispersal.germination_rate) || 0;
  species.dispersal.germination_rate = 1;

  tile.dormantSeeds = {
    [speciesId]: {
      count: 1,
      ageDays: 0,
      source: 'test',
    },
  };
  tile.simpleSnare = {
    active: true,
    hasCatch: false,
    poached: false,
    sprung: false,
    reliability: 1,
    rabbitDensity: 0,
    placedYear: state.year,
    placedDay: state.dayOfYear,
    placedDayTick: state.dayTick,
    catchResolvedTotalDays: null,
    daysSinceCatch: 0,
    lastResolvedYear: null,
    lastResolvedDay: null,
    lastRoll: null,
    lastPoachChance: null,
    lastPoachRoll: null,
  };

  const next = advanceDay(state, 1);

  species.dispersal.germination_rate = previousRate;

  const nextTile = next.tiles[tile.y * next.width + tile.x];
  assert.equal(nextTile.plantIds.length, 0, 'active trap tile should block germination on that tile');
}

function runTrapPlaceDeadfallValidationRulesTest() {
  const state = createInitialGameState(4281, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for trap_place_deadfall validation');
  const adjacentTile = findAdjacentLandTile(state, playerTile);
  assert.ok(adjacentTile, 'test requires adjacent tile for trap_place_deadfall validation');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires far tile for trap_place_deadfall range rejection');

  player.x = playerTile.x;
  player.y = playerTile.y;

  const missingTrap = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_deadfall',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(missingTrap.ok, false, 'trap_place_deadfall should require deadfall item in inventory');
  assert.equal(missingTrap.code, 'insufficient_item_quantity', 'missing deadfall should return insufficient_item_quantity');

  player.inventory.stacks = [{ itemId: 'tool:dead_fall_trap', quantity: 1 }];
  const valid = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_deadfall',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(valid.ok, true, 'trap_place_deadfall should validate on adjacent land tile when trap is carried');
  assert.equal(valid.normalizedAction.tickCost, 3, 'trap_place_deadfall should normalize to 3 tick cost');

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_deadfall',
    payload: { x: farTile.x, y: farTile.y },
  });
  assert.equal(farValidation.ok, false, 'trap_place_deadfall should reject far target tile');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'far trap_place_deadfall target should return interaction_out_of_range');

  adjacentTile.plantIds = ['occupied_plant'];
  const occupiedValidation = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_deadfall',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(occupiedValidation.ok, false, 'trap_place_deadfall should reject tiles with existing plants');
  assert.equal(occupiedValidation.code, 'trap_place_deadfall_tile_occupied', 'plant-occupied deadfall tile should return trap_place_deadfall_tile_occupied');
}

function runTrapPlaceDeadfallRuntimeAndDailyResolutionTest() {
  const state = createInitialGameState(4282, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires land tile for trap_place_deadfall runtime');

  player.x = landTile.x;
  player.y = landTile.y;
  if (!Array.isArray(player.inventory?.stacks)) {
    player.inventory.stacks = [];
  }
  player.inventory.stacks.push({ itemId: 'tool:hoe', quantity: 1 });
  player.tickBudgetCurrent = Math.max(1, Math.floor(Number(player.tickBudgetCurrent) || 1));
  if (!state.techUnlocks || typeof state.techUnlocks !== 'object') {
    state.techUnlocks = {};
  }
  state.techUnlocks.unlock_tool_hoe = true;
  player.inventory.stacks = [{ itemId: 'tool:dead_fall_trap', quantity: 1 }];

  const tileKey = `${landTile.x},${landTile.y}`;
  state.animalZonesGenerated = true;
  state.animalDensityByZone = {
    ...(state.animalDensityByZone || {}),
    sylvilagus_floridanus: {
      ...(state.animalDensityByZone?.sylvilagus_floridanus || {}),
      [tileKey]: 1,
    },
    sciurus_carolinensis: {
      ...(state.animalDensityByZone?.sciurus_carolinensis || {}),
      [tileKey]: 1,
    },
  };

  const placed = advanceTick(state, {
    actions: [
      {
        actionId: 'trap-place-deadfall',
        actorId: 'player',
        kind: 'trap_place_deadfall',
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const placeLog = placed.currentDayActionLog.find((entry) => entry.actionId === 'trap-place-deadfall');
  assert.ok(placeLog && placeLog.status === 'applied', 'trap_place_deadfall runtime action should be applied');
  assert.equal(placeLog.tickCost, 3, 'trap_place_deadfall should consume 3 ticks');

  const placedTile = placed.tiles[landTile.y * placed.width + landTile.x];
  assert.ok(placedTile.deadfallTrap && placedTile.deadfallTrap.active === true, 'trap_place_deadfall should persist active deadfallTrap state');
  assert.equal(
    placed.actors.player.inventory.stacks.some((entry) => entry.itemId === 'tool:dead_fall_trap'),
    false,
    'trap_place_deadfall should consume one deadfall item from inventory',
  );

  const dayResolvedA = advanceDay(placed, 1);
  const dayResolvedB = advanceDay(placed, 1);
  const resolvedTileA = dayResolvedA.tiles[landTile.y * dayResolvedA.width + landTile.x];
  const resolvedTileB = dayResolvedB.tiles[landTile.y * dayResolvedB.width + landTile.x];

  assert.ok(resolvedTileA.deadfallTrap, 'daily deadfall resolution should preserve deadfallTrap state');
  assert.equal(
    resolvedTileA.deadfallTrap.hasCatch,
    resolvedTileB.deadfallTrap.hasCatch,
    'daily deadfall resolution should be deterministic for identical input state',
  );
  assert.equal(
    resolvedTileA.deadfallTrap.lastRoll,
    resolvedTileB.deadfallTrap.lastRoll,
    'daily deadfall resolution roll should be deterministic for identical input state',
  );
}

function runTrapPlaceFishWeirValidationRulesTest() {
  const state = createInitialGameState(4287, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for trap_place_fish_weir validation');
  const adjacentTile = findAdjacentTileMatching(state, playerTile, () => true);
  assert.ok(adjacentTile, 'test requires adjacent tile for trap_place_fish_weir validation');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires far tile for trap_place_fish_weir range rejection');

  adjacentTile.waterType = 'river';
  adjacentTile.waterDepth = 'shallow';
  adjacentTile.waterCurrentStrength = 0.6;
  adjacentTile.waterCurrentBand = 'medium';
  adjacentTile.waterFrozen = false;

  player.x = playerTile.x;
  player.y = playerTile.y;

  const missingTrap = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_fish_weir',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(missingTrap.ok, false, 'trap_place_fish_weir should require fish trap weir item in inventory');
  assert.equal(missingTrap.code, 'insufficient_item_quantity', 'missing fish trap weir should return insufficient_item_quantity');

  player.inventory.stacks = [{ itemId: 'tool:fish_trap_weir', quantity: 1 }];
  const valid = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_fish_weir',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(valid.ok, true, 'trap_place_fish_weir should validate on adjacent moving-water tile when weir is carried');
  assert.equal(valid.normalizedAction.tickCost, 4, 'trap_place_fish_weir should normalize to 4 tick cost');

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_fish_weir',
    payload: { x: farTile.x, y: farTile.y },
  });
  assert.equal(farValidation.ok, false, 'trap_place_fish_weir should reject far target tile');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'far trap_place_fish_weir target should return interaction_out_of_range');

  adjacentTile.waterFrozen = true;
  const frozenValidation = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_fish_weir',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(frozenValidation.ok, false, 'trap_place_fish_weir should reject frozen water placement');
  assert.equal(frozenValidation.code, 'trap_place_fish_weir_invalid_target', 'frozen fish weir placement should return trap_place_fish_weir_invalid_target');
}

function runTrapPlaceFishWeirRuntimeAndDailyResolutionTest() {
  const state = createInitialGameState(4288, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires land tile for trap_place_fish_weir runtime');
  const riverTile = findAdjacentTileMatching(state, playerTile, () => true);
  assert.ok(riverTile, 'test requires adjacent target tile for trap_place_fish_weir runtime');

  riverTile.waterType = 'river';
  riverTile.waterDepth = 'shallow';
  riverTile.waterCurrentStrength = 0.8;
  riverTile.waterCurrentBand = 'fast';
  riverTile.waterFrozen = false;

  player.x = playerTile.x;
  player.y = playerTile.y;
  player.inventory.stacks = [{ itemId: 'tool:fish_trap_weir', quantity: 1 }];

  const tileKey = `${riverTile.x},${riverTile.y}`;
  state.fishPopulationsGenerated = true;
  state.fishDensityByTile = {
    ...(state.fishDensityByTile || {}),
    catostomus_commersonii: {
      ...(state.fishDensityByTile?.catostomus_commersonii || {}),
      [tileKey]: 1,
    },
  };
  state.fishEquilibriumByTile = {
    ...(state.fishEquilibriumByTile || {}),
    catostomus_commersonii: {
      ...(state.fishEquilibriumByTile?.catostomus_commersonii || {}),
      [tileKey]: 1,
    },
  };

  const placed = advanceTick(state, {
    actions: [
      {
        actionId: 'trap-place-fish-weir',
        actorId: 'player',
        kind: 'trap_place_fish_weir',
        payload: { x: riverTile.x, y: riverTile.y },
      },
    ],
  });

  const placeLog = placed.currentDayActionLog.find((entry) => entry.actionId === 'trap-place-fish-weir');
  assert.ok(placeLog && placeLog.status === 'applied', 'trap_place_fish_weir runtime action should be applied');
  assert.equal(placeLog.tickCost, 4, 'trap_place_fish_weir should consume 4 ticks');

  const placedTile = placed.tiles[riverTile.y * placed.width + riverTile.x];
  assert.ok(placedTile.fishTrap && placedTile.fishTrap.active === true, 'trap_place_fish_weir should persist active tile fishTrap state');
  assert.equal(
    placed.actors.player.inventory.stacks.some((entry) => entry.itemId === 'tool:fish_trap_weir'),
    false,
    'trap_place_fish_weir should consume one fish trap weir item from inventory',
  );

  const dayResolvedA = advanceDay(placed, 1);
  const dayResolvedB = advanceDay(placed, 1);
  const resolvedTileA = dayResolvedA.tiles[riverTile.y * dayResolvedA.width + riverTile.x];
  const resolvedTileB = dayResolvedB.tiles[riverTile.y * dayResolvedB.width + riverTile.x];
  assert.ok(resolvedTileA.fishTrap, 'daily fish trap resolution should preserve fishTrap state');
  assert.deepEqual(
    resolvedTileA.fishTrap.storedCatchSpeciesIds,
    resolvedTileB.fishTrap.storedCatchSpeciesIds,
    'daily fish trap resolution stored catches should be deterministic for identical input state',
  );
  assert.ok(
    resolvedTileA.fishTrap.storedCatchSpeciesIds.length <= 3,
    'daily fish trap resolution should respect max stored catch capacity',
  );
}

function runTrapCheckRetrievesFishCarcassAndResetsFishTrapTest() {
  const state = createInitialGameState(4289, { width: 30, height: 30 });
  const player = state.actors.player;
  const riverTile = state.tiles.find((tile) => (
    tile
    && tile.waterType === 'river'
    && tile.waterFrozen !== true
    && findAdjacentTileMatching(state, tile, (candidate) => candidate && !candidate.waterType && !candidate.rockType)
  ));
  assert.ok(riverTile, 'test requires river tile for fish trap_check retrieval');
  const adjacentLand = findAdjacentTileMatching(state, riverTile, (tile) => tile && !tile.waterType && !tile.rockType);
  assert.ok(adjacentLand, 'test requires adjacent land tile near river for fish trap_check retrieval');

  player.x = adjacentLand.x;
  player.y = adjacentLand.y;

  riverTile.fishTrap = {
    active: true,
    sprung: true,
    reliability: 0.8,
    storedCatchSpeciesIds: ['catostomus_commersonii', 'esox_lucius'],
    maxStoredCatch: 3,
    placedYear: state.year,
    placedDay: state.dayOfYear,
    placedDayTick: 0,
    lastResolvedYear: state.year,
    lastResolvedDay: state.dayOfYear,
    lastCatchCount: 2,
    lastDensity: 0.9,
    lastRoll: 0.2,
  };

  const validated = validateAction(state, {
    actorId: 'player',
    kind: 'trap_check',
    payload: { x: riverTile.x, y: riverTile.y },
  });
  assert.equal(validated.ok, true, 'trap_check should validate on active fish trap tile in range');

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'trap-check-fish-weir',
        actorId: 'player',
        kind: 'trap_check',
        payload: { x: riverTile.x, y: riverTile.y },
      },
    ],
  });

  const tileAfter = next.tiles[riverTile.y * next.width + riverTile.x];
  assert.ok(tileAfter.fishTrap, 'trap_check should preserve fishTrap object on tile');
  assert.deepEqual(tileAfter.fishTrap.storedCatchSpeciesIds, [], 'trap_check should clear stored fish catches after retrieval');
  assert.equal(tileAfter.fishTrap.sprung, false, 'trap_check should reset fish trap sprung state after retrieval');

  const suckerCarcass = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'catostomus_commersonii:fish_carcass');
  const pikeCarcass = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'esox_lucius:fish_carcass');
  assert.ok(suckerCarcass, 'trap_check should add fish carcass for first stored fish catch');
  assert.ok(pikeCarcass, 'trap_check should add fish carcass for second stored fish catch');
}

function runFishCarcassNotFieldEdibleAndNoCleanProcessTest() {
  const state = createInitialGameState(4290, { width: 30, height: 30 });
  const player = state.actors.player;
  player.inventory.stacks = [{ itemId: 'catostomus_commersonii:fish_carcass', quantity: 1 }];

  const eatValidation = validateAction(state, {
    actorId: 'player',
    kind: 'eat',
    payload: { itemId: 'catostomus_commersonii:fish_carcass', quantity: 1 },
  });
  assert.equal(eatValidation.ok, false, 'fish carcass should not be field edible');
  assert.equal(eatValidation.code, 'item_not_field_edible', 'fish carcass should reject eat with item_not_field_edible');

  const cleanValidation = validateAction(state, {
    actorId: 'player',
    kind: 'process_item',
    payload: {
      itemId: 'catostomus_commersonii:fish_carcass',
      processId: 'clean',
      quantity: 1,
    },
  });
  assert.equal(cleanValidation.ok, false, 'fish carcass should not support a separate clean process step');
  assert.equal(cleanValidation.code, 'unknown_process_option', 'fish carcass clean should reject with unknown_process_option');
}

function runFishRodCastValidationRulesTest() {
  const state = createInitialGameState(4291, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for fish_rod_cast validation');
  const waterTile = findAdjacentTileMatching(state, playerTile, () => true);
  assert.ok(waterTile, 'test requires adjacent tile for fish_rod_cast validation');

  waterTile.waterType = 'river';
  waterTile.waterDepth = 'shallow';
  waterTile.waterCurrentStrength = 0.3;
  waterTile.waterFrozen = false;

  player.x = playerTile.x;
  player.y = playerTile.y;

  const missingRod = validateAction(state, {
    actorId: 'player',
    kind: 'fish_rod_cast',
    payload: { tickCost: 5 },
  });
  assert.equal(missingRod.ok, false, 'fish_rod_cast should require fishing rod in inventory');
  assert.equal(missingRod.code, 'insufficient_item_quantity', 'missing fishing rod should return insufficient_item_quantity');

  player.inventory.stacks = [{ itemId: 'tool:fishing_rod', quantity: 1 }];
  const lowTick = validateAction(state, {
    actorId: 'player',
    kind: 'fish_rod_cast',
    payload: { tickCost: 4 },
  });
  assert.equal(lowTick.ok, false, 'fish_rod_cast should reject tickCost below minimum');
  assert.equal(lowTick.code, 'invalid_tick_cost', 'fish_rod_cast low tickCost should return invalid_tick_cost');

  const invalidBait = validateAction(state, {
    actorId: 'player',
    kind: 'fish_rod_cast',
    payload: { tickCost: 6, baitItemId: 'bee_larvae' },
  });
  assert.equal(invalidBait.ok, false, 'fish_rod_cast should reject unsupported bait item');
  assert.equal(invalidBait.code, 'invalid_bait_item', 'unsupported fish bait should return invalid_bait_item');

  player.inventory.stacks.push({ itemId: 'earthworm', quantity: 1 });
  const valid = validateAction(state, {
    actorId: 'player',
    kind: 'fish_rod_cast',
    payload: { tickCost: 6, baitItemId: 'earthworm' },
  });
  assert.equal(valid.ok, true, 'fish_rod_cast should validate with rod, adjacent water, and earthworm bait');
  assert.ok(Array.isArray(valid.normalizedAction.payload.fishableTargets), 'fish_rod_cast should normalize fishable target list');
  assert.ok(valid.normalizedAction.payload.fishableTargets.length > 0, 'fish_rod_cast should include at least one fishable target');
}

function runFishRodCastEarlyStopAndDensityBehaviorTest() {
  const state = createInitialGameState(4292, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for fish_rod_cast runtime');
  const waterTile = findAdjacentTileMatching(state, playerTile, () => true);
  assert.ok(waterTile, 'test requires adjacent water tile for fish_rod_cast runtime');

  waterTile.waterType = 'river';
  waterTile.waterDepth = 'shallow';
  waterTile.waterCurrentStrength = 0;
  waterTile.waterFrozen = false;

  const tileKey = `${waterTile.x},${waterTile.y}`;
  state.fishPopulationsGenerated = true;
  state.fishDensityByTile = state.fishDensityByTile || {};
  const rodSpecies = Object.values(ANIMAL_BY_ID || {})
    .filter((species) => species?.animalClass === 'fish' && species?.rodCompatible === true)
    .map((species) => species.id)
    .filter((speciesId) => typeof speciesId === 'string' && speciesId);
  assert.ok(rodSpecies.length > 0, 'test requires at least one rod-compatible fish species');
  for (const speciesId of rodSpecies) {
    if (!state.fishDensityByTile[speciesId]) {
      state.fishDensityByTile[speciesId] = {};
    }
    state.fishDensityByTile[speciesId][tileKey] = 1;
  }

  player.x = playerTile.x;
  player.y = playerTile.y;
  player.inventory.stacks = [
    { itemId: 'tool:fishing_rod', quantity: 1 },
    { itemId: 'earthworm', quantity: 1 },
  ];

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'fish-rod-cast-early-stop',
        actorId: 'player',
        kind: 'fish_rod_cast',
        payload: { tickCost: 20, baitItemId: 'earthworm' },
      },
    ],
  });

  const logEntry = next.currentDayActionLog.find((entry) => entry.actionId === 'fish-rod-cast-early-stop');
  assert.ok(logEntry && logEntry.status === 'applied', 'fish_rod_cast should apply');
  assert.ok(logEntry.tickCost >= 1 && logEntry.tickCost <= 20, 'fish_rod_cast should consume a positive tick amount up to invested ticks');
  if (String(logEntry.message || '').includes('bite_resolved_early')) {
    assert.ok(logEntry.tickCost < 20, 'fish_rod_cast early bite resolution should spend fewer ticks than invested');
  }

  const earthwormStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'earthworm');
  assert.ok(!earthwormStack || earthwormStack.quantity <= 0, 'fish_rod_cast bite should consume earthworm bait');
  assert.ok(next.actors.player.lastFishing, 'fish_rod_cast bite should write lastFishing summary');

  const caught = next.actors.player.inventory.stacks.find((entry) => typeof entry.itemId === 'string' && entry.itemId.endsWith(':fish_carcass'));
  if (caught) {
    const speciesId = String(caught.itemId).split(':')[0];
    const beforeDensity = Number(state.fishDensityByTile?.[speciesId]?.[tileKey] || 0);
    const afterDensity = Number(next.fishDensityByTile?.[speciesId]?.[tileKey] || 0);
    assert.ok(afterDensity < beforeDensity, 'successful fish_rod_cast catch should reduce local fish density');
  } else {
    for (const speciesId of rodSpecies) {
      const beforeDensity = Number(state.fishDensityByTile?.[speciesId]?.[tileKey] || 0);
      const afterDensity = Number(next.fishDensityByTile?.[speciesId]?.[tileKey] || 0);
      assert.equal(afterDensity, beforeDensity, 'fish_rod_cast escape should not change local fish density');
    }
  }
}

function runDigEarthwormSpawnAndFrozenBlockTest() {
  let selectedSeed = null;
  let selectedTarget = null;
  let spawned = null;

  for (let seed = 1; seed <= 200 && !selectedSeed; seed += 1) {
    const candidate = createInitialGameState(seed, { width: 30, height: 30 });
    const candidatePlayer = candidate.actors.player;
    const candidateTarget = candidate.tiles.find((tile) => !tile.waterType && !tile.rockType);
    if (!candidateTarget) {
      continue;
    }

    candidateTarget.moisture = 1;
    candidatePlayer.x = candidateTarget.x;
    candidatePlayer.y = candidateTarget.y;

    const next = advanceTick(candidate, {
      actions: [
        {
          actionId: 'dig-earthworm-spawn',
          actorId: 'player',
          kind: 'dig',
          payload: { x: candidateTarget.x, y: candidateTarget.y },
        },
      ],
    });

    const spawnedEarthworms = Object.values(next.worldItemsByTile || {})
      .flat()
      .filter((stack) => stack?.itemId === 'earthworm');
    if (spawnedEarthworms.length > 0) {
      selectedSeed = seed;
      selectedTarget = { x: candidateTarget.x, y: candidateTarget.y };
      spawned = next;
    }
  }

  assert.ok(Number.isInteger(selectedSeed), 'test requires at least one seed that produces earthworm spawn on dig');

  const spawnedEarthworms = Object.values(spawned.worldItemsByTile || {})
    .flat()
    .filter((stack) => stack?.itemId === 'earthworm');
  assert.ok(spawnedEarthworms.length > 0, 'dig should spawn nearby earthworm drop when moisture-based roll succeeds');

  const frozenState = createInitialGameState(selectedSeed, { width: 30, height: 30 });
  const frozenPlayer = frozenState.actors.player;
  const frozenTarget = frozenState.tiles[selectedTarget.y * frozenState.width + selectedTarget.x];
  assert.ok(frozenTarget, 'test requires frozen dig target tile');
  frozenTarget.moisture = 1;
  frozenTarget.waterFrozen = true;
  frozenPlayer.x = frozenTarget.x;
  frozenPlayer.y = frozenTarget.y;

  const frozenResult = advanceTick(frozenState, {
    actions: [
      {
        actionId: 'dig-earthworm-frozen',
        actorId: 'player',
        kind: 'dig',
        payload: { x: frozenTarget.x, y: frozenTarget.y },
      },
    ],
  });

  const frozenEarthworms = Object.values(frozenResult.worldItemsByTile || {})
    .flat()
    .filter((stack) => stack?.itemId === 'earthworm');
  assert.equal(frozenEarthworms.length, 0, 'dig should not spawn earthworms on frozen tile');
}

function runEarthwormGroundDecayEscapesTest() {
  const state = createInitialGameState(4294, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires land tile for earthworm decay behavior');

  const key = `${landTile.x},${landTile.y}`;
  state.worldItemsByTile[key] = [{ itemId: 'earthworm', quantity: 1, decayDaysRemaining: 1 }];
  player.inventory.stacks = [{ itemId: 'earthworm', quantity: 1, decayDaysRemaining: 1 }];

  const next = advanceDay(state, 2);
  const worldStacks = next.worldItemsByTile[key] || [];
  assert.equal(
    worldStacks.some((stack) => stack?.itemId === 'earthworm'),
    false,
    'ground earthworm should disappear on decay (escape)',
  );
  assert.equal(
    worldStacks.some((stack) => stack?.itemId === 'rotting_organic'),
    false,
    'ground earthworm should not convert into rotting_organic',
  );

  const inventoryRotting = next.actors.player.inventory.stacks.find((stack) => stack.itemId === 'rotting_organic');
  assert.ok(inventoryRotting, 'inventory earthworm should decay via standard rotting flow');
}

function pickDryablePlantItemId() {
  for (const [speciesId, species] of Object.entries(PLANT_BY_ID || {})) {
    for (const part of species?.parts || []) {
      for (const subStage of part?.subStages || []) {
        if (subStage?.can_dry === true) {
          return `${speciesId}:${part.name}:${subStage.id}`;
        }
      }
    }
  }
  return null;
}

function getStabilizedState(seed, dimensions, days = 400) {
  const width = Number(dimensions?.width) || 40;
  const height = Number(dimensions?.height) || 40;
  const key = `${seed}:${width}x${height}:${days}`;
  let cached = STABILIZED_STATE_CACHE.get(key);

  if (!cached) {
    cached = advanceDay(createInitialGameState(seed, { width, height }), days);
    STABILIZED_STATE_CACHE.set(key, cached);
  }

  return cloneGameStateForTest(cached);
}

function drainageToIndex(drainage) {
  const idx = DRAINAGE_ORDER.indexOf(drainage);
  if (idx === -1) {
    return 0.5;
  }

  return idx / (DRAINAGE_ORDER.length - 1);
}

function runAdvanceTickDeterminismTest() {
  const actions = [
    {
      actionId: 'a1',
      actorId: 'player',
      kind: 'move',
      issuedAtTick: 0,
      payload: { dx: 1, dy: 0 },
    },
    {
      actionId: 'a2',
      actorId: 'player',
      kind: 'inspect',
      issuedAtTick: 1,
      payload: {},
    },
  ];

  const a = createInitialGameState(4201, { width: 40, height: 40 });
  const b = createInitialGameState(4201, { width: 40, height: 40 });

  const nextA = advanceTick(a, { actions, idleTicks: 9 });
  const nextB = advanceTick(b, { actions, idleTicks: 9 });

  assert.equal(
    JSON.stringify(nextA),
    JSON.stringify(nextB),
    'advanceTick should be deterministic for identical seed and action stream',
  );
}

function runActionStreamReplayEquivalenceTest() {
  const actionStream = [
    {
      actionId: 'r1',
      actorId: 'player',
      kind: 'move',
      issuedAtTick: 0,
      payload: { dx: 1, dy: 0 },
    },
    {
      actionId: 'r2',
      actorId: 'player',
      kind: 'inspect',
      issuedAtTick: 1,
      payload: { dx: 0, dy: 0 },
    },
    {
      actionId: 'r3',
      actorId: 'player',
      kind: 'move',
      issuedAtTick: 2,
      payload: { dx: 0, dy: 1 },
    },
    {
      actionId: 'r4',
      actorId: 'player',
      kind: 'dig',
      issuedAtTick: 3,
      payload: { dx: 0, dy: 0 },
    },
  ];

  const base = createInitialGameState(4221, { width: 40, height: 40 });
  const batched = advanceTick(base, { actions: actionStream, idleTicks: 3 });

  let replayed = createInitialGameState(4221, { width: 40, height: 40 });
  for (const action of actionStream) {
    replayed = advanceTick(replayed, { actions: [action] });
  }
  replayed = advanceTick(replayed, { idleTicks: 3 });

  assert.equal(
    JSON.stringify(replayed),
    JSON.stringify(batched),
    'stepwise replay should match batched execution for identical deterministic action stream',
  );
}

function runActionUnlockGateTest() {
  const state = createInitialGameState(4222, { width: 30, height: 30 });
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one diggable land tile');

  state.actors.player.x = landTile.x;
  state.actors.player.y = landTile.y;
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_digging_tools: false,
    unlock_station_building: false,
  };

  const validation = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(validation.ok, true, 'dig should remain valid regardless of tech unlock flags');

  const allActions = getAllActions(state, 'player');
  const digAction = allActions.find((entry) => entry.kind === 'dig');
  assert.ok(digAction, 'getAllActions should include dig entry');
  assert.equal(digAction.available, true, 'dig should remain available regardless of tech unlock flags');
  assert.equal(digAction.reason, null, 'dig should not report unlock-based block reason');
}

function runParameterizedRecipeUnlockGateTest() {
  const state = createInitialGameState(4223, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.actors.player.inventory.stacks = [
    { itemId: 'flint_cobble', quantity: 1 },
    { itemId: 'cordage', quantity: 2 },
  ];
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_station_drying_rack: false,
    unlock_tool_axe: false,
    unlock_tool_ladder: false,
    unlock_tool_simple_snare: false,
  };

  const freeStationValidation = validateAction(state, {
    actorId: 'player',
    kind: 'camp_station_build',
    payload: { stationId: 'raised_sleeping_platform' },
  });
  assert.equal(freeStationValidation.ok, true, 'no-research station recipe should validate');

  const lockedStationValidation = validateAction(state, {
    actorId: 'player',
    kind: 'camp_station_build',
    payload: { stationId: 'drying_rack' },
  });
  assert.equal(lockedStationValidation.ok, false, 'research-locked station recipe should reject when unlock is false');
  assert.equal(lockedStationValidation.code, 'missing_unlock', 'locked station recipe should reject with missing_unlock');

  const freeToolValidation = validateAction(state, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'flint_knife' },
  });
  assert.equal(freeToolValidation.ok, true, 'no-research tool recipe should validate');
  assert.equal(
    freeToolValidation.normalizedAction.payload.outputItemId,
    'tool:flint_knife',
    'tool_craft should normalize deterministic output payload for free recipe',
  );

  const lockedToolValidation = validateAction(state, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'axe' },
  });
  assert.equal(lockedToolValidation.ok, false, 'research-locked tool recipe should reject when unlock is false');
  assert.equal(lockedToolValidation.code, 'missing_unlock', 'locked tool recipe should reject with missing_unlock');

  const lockedLadderValidation = validateAction(state, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'ladder' },
  });
  assert.equal(lockedLadderValidation.ok, false, 'ladder recipe should reject when unlock is false');
  assert.equal(lockedLadderValidation.code, 'missing_unlock', 'ladder recipe should reject with missing_unlock');

  const lockedSnareValidation = validateAction(state, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'simple_snare' },
  });
  assert.equal(lockedSnareValidation.ok, false, 'simple_snare recipe should reject when unlock is false');
  assert.equal(lockedSnareValidation.code, 'missing_unlock', 'simple_snare recipe should reject with missing_unlock');

  const listed = getAllActions(state, 'player');
  const stationAction = listed.find((entry) => entry.kind === 'camp_station_build');
  const toolAction = listed.find((entry) => entry.kind === 'tool_craft');
  assert.ok(stationAction && stationAction.available, 'camp_station_build action kind should remain available even if some recipes are locked');
  assert.ok(toolAction && toolAction.available, 'tool_craft action kind should remain available even if some recipes are locked');

  const unlocked = createInitialGameState(4223, { width: 30, height: 30 });
  unlocked.actors.player.x = unlocked.camp.anchorX;
  unlocked.actors.player.y = unlocked.camp.anchorY;
  unlocked.actors.player.inventory.stacks = [
    { itemId: 'flint_cobble', quantity: 1 },
    { itemId: 'branch', quantity: 1 },
    { itemId: 'pole', quantity: 4 },
    { itemId: 'cordage', quantity: 10 },
  ];
  unlocked.techUnlocks = {
    ...(unlocked.techUnlocks || {}),
    unlock_station_drying_rack: true,
    unlock_tool_axe: true,
    unlock_tool_ladder: true,
    unlock_tool_simple_snare: true,
  };

  const unlockedStationValidation = validateAction(unlocked, {
    actorId: 'player',
    kind: 'camp_station_build',
    payload: { stationId: 'drying_rack' },
  });
  assert.equal(unlockedStationValidation.ok, true, 'research-locked station recipe should validate when unlock is true');

  const unlockedToolValidation = validateAction(unlocked, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'axe' },
  });
  assert.equal(unlockedToolValidation.ok, true, 'research-locked tool recipe should validate when unlock is true');

  const unlockedLadderValidation = validateAction(unlocked, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'ladder' },
  });
  assert.equal(unlockedLadderValidation.ok, true, 'ladder recipe should validate when unlock is true');
  assert.equal(unlockedLadderValidation.normalizedAction.payload.outputItemId, 'tool:ladder', 'ladder recipe should normalize ladder output item');
  assert.equal(unlockedLadderValidation.normalizedAction.payload.outputFootprintW, 2, 'ladder recipe should normalize 2x4 output footprint width');
  assert.equal(unlockedLadderValidation.normalizedAction.payload.outputFootprintH, 4, 'ladder recipe should normalize 2x4 output footprint height');

  const unlockedSnareValidation = validateAction(unlocked, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'simple_snare' },
  });
  assert.equal(unlockedSnareValidation.ok, true, 'simple_snare recipe should validate when unlock is true');
  assert.equal(unlockedSnareValidation.normalizedAction.payload.outputItemId, 'tool:simple_snare', 'simple_snare recipe should normalize snare output item');
}

function runCampStationAndToolCraftCoreEffectsTest() {
  const state = createInitialGameState(4224, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.actors.player.inventory.stacks = [
    { itemId: 'flint_cobble', quantity: 1 },
    { itemId: 'pole', quantity: 4 },
    { itemId: 'cordage', quantity: 5 },
  ];
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_station_drying_rack: true,
    unlock_tool_ladder: true,
  };

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'build-drying-rack',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'drying_rack' },
      },
      {
        actionId: 'craft-flint-knife',
        actorId: 'player',
        kind: 'tool_craft',
        payload: { recipeId: 'flint_knife' },
      },
      {
        actionId: 'craft-ladder',
        actorId: 'player',
        kind: 'tool_craft',
        payload: { recipeId: 'ladder' },
      },
    ],
  });

  assert.ok(
    next.camp.stationsUnlocked.includes('drying_rack'),
    'camp_station_build should add built station to camp.stationsUnlocked',
  );

  const knifeStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:flint_knife');
  assert.ok(knifeStack, 'tool_craft should add crafted tool output to actor inventory');
  assert.equal(knifeStack.quantity, 1, 'tool_craft should add normalized output quantity');

  const ladderStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:ladder');
  assert.ok(ladderStack, 'tool_craft should add crafted ladder output to actor inventory');
  assert.equal(ladderStack.quantity, 1, 'tool_craft should add ladder output quantity');
  assert.equal(ladderStack.footprintW, 2, 'crafted ladder inventory stack should use 2x4 footprint width');
  assert.equal(ladderStack.footprintH, 4, 'crafted ladder inventory stack should use 2x4 footprint height');

  assert.equal(
    next.actors.player.inventory.stacks.some((entry) => entry.itemId === 'flint_cobble'),
    false,
    'tool_craft should consume flint_cobble material from inventory',
  );
  assert.equal(
    next.actors.player.inventory.stacks.some((entry) => entry.itemId === 'pole'),
    false,
    'tool_craft should consume pole materials from inventory',
  );
  assert.equal(
    next.actors.player.inventory.stacks.some((entry) => entry.itemId === 'cordage'),
    false,
    'tool_craft should consume all provided cordage for knife + ladder recipes',
  );
}

function runHarvestRockMaterialsFromBouldersTest() {
  const state = createInitialGameState(4285, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTiles = state.tiles.filter((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTiles.length >= 2, 'test requires at least two land tiles for synthetic rock harvest checks');
  const erraticTile = landTiles[0];
  const flintTile = landTiles[1];
  erraticTile.rockType = 'glacial_erratic';
  flintTile.rockType = 'flint_cobble_scatter';
  flintTile.flintCobbleRemaining = 1;
  assert.ok(erraticTile, 'test requires glacial_erratic tile for rock harvest material checks');
  assert.ok(flintTile, 'test requires flint_cobble_scatter tile for rock harvest material checks');

  player.x = erraticTile.x;
  player.y = erraticTile.y;

  const erraticValidation = validateAction(state, {
    actorId: 'player',
    kind: 'harvest',
    payload: { x: erraticTile.x, y: erraticTile.y },
  });
  assert.equal(erraticValidation.ok, true, 'harvest should validate on glacial_erratic tile');
  assert.equal(erraticValidation.normalizedAction.tickCost, 3, 'glacial_erratic harvest should normalize to 3 ticks');
  assert.equal(erraticValidation.normalizedAction.payload.outputItemId, 'heavy_rock', 'glacial_erratic should yield heavy_rock material');

  const afterErratic = advanceTick(state, {
    actions: [
      {
        actionId: 'harvest-erratic',
        actorId: 'player',
        kind: 'harvest',
        payload: { x: erraticTile.x, y: erraticTile.y },
      },
    ],
  });
  assert.ok(
    afterErratic.actors.player.inventory.stacks.some((entry) => entry.itemId === 'heavy_rock'),
    'harvest on glacial_erratic should add heavy_rock to inventory',
  );

  const flintState = createInitialGameState(4286, { width: 30, height: 30 });
  const flintPlayer = flintState.actors.player;
  const flintTarget = flintState.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(flintTarget, 'test requires flint_cobble_scatter tile for depletion checks');
  flintTarget.rockType = 'flint_cobble_scatter';
  flintPlayer.x = flintTarget.x;
  flintPlayer.y = flintTarget.y;

  const flintValidation = validateAction(flintState, {
    actorId: 'player',
    kind: 'harvest',
    payload: { x: flintTarget.x, y: flintTarget.y },
  });
  assert.equal(flintValidation.ok, true, 'harvest should validate on flint_cobble_scatter with positive remaining supply');
  assert.equal(flintValidation.normalizedAction.tickCost, 5, 'flint cobble harvest should normalize to 5 ticks');
  assert.equal(flintValidation.normalizedAction.payload.outputItemId, 'flint_cobble', 'flint cobble scatter should yield flint_cobble material');

  const afterFlintHarvest = advanceTick(flintState, {
    actions: [
      {
        actionId: 'harvest-flint-once',
        actorId: 'player',
        kind: 'harvest',
        payload: { x: flintTarget.x, y: flintTarget.y },
      },
    ],
  });

  assert.ok(
    afterFlintHarvest.actors.player.inventory.stacks.some((entry) => entry.itemId === 'flint_cobble'),
    'flint harvest should add flint_cobble to inventory',
  );

  const repeatValidation = validateAction(afterFlintHarvest, {
    actorId: 'player',
    kind: 'harvest',
    payload: { x: flintTarget.x, y: flintTarget.y },
  });
  assert.equal(repeatValidation.ok, true, 'flint cobble scatter harvest should remain valid on repeat (infinite supply)');
}

function runHarvestReachTierToolRequirementsTest() {
  const state = createInitialGameState(4271, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for reach-tier harvest requirements');
  player.x = playerTile.x;
  player.y = playerTile.y;

  const speciesId = 'test_species_reach_tier';
  const previousSpecies = PLANT_BY_ID[speciesId];
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
            id: 'ground_leaf',
            reach_tier: 'ground',
            harvest_base_ticks: 2,
            harvest_tool_modifiers: {},
            harvest_yield: { units_per_action: [1, 1], actions_until_depleted: [2, 2] },
          },
          {
            id: 'elevated_leaf',
            reach_tier: 'elevated',
            harvest_base_ticks: 2,
            harvest_tool_modifiers: {},
            harvest_yield: {
              units_per_action: [1, 1],
              actions_until_depleted: [3, 3],
              ground_action_fraction: 1 / 3,
            },
          },
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
    state.plants = {
      reach_tier_plant: {
        id: 'reach_tier_plant',
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
            subStageId: 'ground_leaf',
            initialActionsRoll: 2,
            initialActionsGround: 2,
            initialActionsElevated: 0,
            initialActionsCanopy: 0,
            remainingActionsGround: 2,
            remainingActionsElevated: 0,
            remainingActionsCanopy: 0,
            remainingActions: 2,
          },
          {
            partName: 'leaf',
            subStageId: 'elevated_leaf',
            initialActionsRoll: 3,
            initialActionsGround: 1,
            initialActionsElevated: 2,
            initialActionsCanopy: 0,
            remainingActionsGround: 1,
            remainingActionsElevated: 2,
            remainingActionsCanopy: 0,
            remainingActions: 3,
          },
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
      },
    };
    playerTile.plantIds = ['reach_tier_plant'];

    player.inventory.stacks = [];
    const elevatedNoTool = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: { plantId: 'reach_tier_plant', partName: 'leaf', subStageId: 'elevated_leaf', actions: 1 },
    });
    assert.equal(elevatedNoTool.ok, true, 'elevated reach harvest should allow ground pool use without stool/ladder');
    assert.equal(elevatedNoTool.normalizedAction.payload.canAccessElevatedPool, false, 'elevated harvest should mark elevated pool inaccessible without stool/ladder');
    assert.equal(elevatedNoTool.normalizedAction.payload.remainingActionsGround, 1, 'elevated harvest should expose ground pool remaining metadata');
    assert.equal(elevatedNoTool.normalizedAction.payload.remainingActionsElevated, 2, 'elevated harvest should expose elevated pool remaining metadata');

    const elevatedGroundOnlyTick = advanceTick(state, {
      actions: [
        {
          actionId: 'harvest-elevated-ground-only',
          actorId: 'player',
          kind: 'harvest',
          issuedAtTick: 0,
          payload: { plantId: 'reach_tier_plant', partName: 'leaf', subStageId: 'elevated_leaf', actions: 1 },
        },
      ],
    });
    const elevatedAfterGroundOnly = elevatedGroundOnlyTick.plants.reach_tier_plant.activeSubStages
      .find((entry) => entry.partName === 'leaf' && entry.subStageId === 'elevated_leaf');
    assert.equal(elevatedAfterGroundOnly.remainingActionsGround, 0, 'ground-only elevated harvest should consume one ground pool action');
    assert.equal(elevatedAfterGroundOnly.remainingActionsElevated, 2, 'ground-only elevated harvest should not consume elevated pool without stool/ladder');

    const elevatedNoToolAfterGroundExhaust = validateAction(elevatedGroundOnlyTick, {
      actorId: 'player',
      kind: 'harvest',
      payload: { plantId: 'reach_tier_plant', partName: 'leaf', subStageId: 'elevated_leaf', actions: 1 },
    });
    assert.equal(elevatedNoToolAfterGroundExhaust.ok, false, 'elevated harvest should require stool/ladder once ground pool is exhausted');
    assert.equal(elevatedNoToolAfterGroundExhaust.code, 'missing_required_tool', 'ground-exhausted elevated harvest should fail with missing_required_tool');
    assert.equal(elevatedNoToolAfterGroundExhaust.requiredToolId, 'tool:stool', 'ground-exhausted elevated harvest should request stool (ladder also valid)');

    const canopyNoTool = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: { plantId: 'reach_tier_plant', partName: 'leaf', subStageId: 'canopy_leaf', actions: 1 },
    });
    assert.equal(canopyNoTool.ok, true, 'canopy reach harvest should allow ground pool actions without ladder');
    assert.equal(canopyNoTool.normalizedAction.payload.remainingActionsGround, 1, 'canopy harvest without ladder should expose ground pool');

    elevatedGroundOnlyTick.actors.player.inventory.stacks = [{ itemId: 'tool:stool', quantity: 1 }];
    const elevatedWithStool = validateAction(elevatedGroundOnlyTick, {
      actorId: 'player',
      kind: 'harvest',
      payload: { plantId: 'reach_tier_plant', partName: 'leaf', subStageId: 'elevated_leaf', actions: 1 },
    });
    assert.equal(elevatedWithStool.ok, true, 'stool should satisfy elevated reach harvest requirement');
    assert.equal(elevatedWithStool.normalizedAction.payload.canAccessElevatedPool, true, 'stool should unlock elevated pool access');

    const canopyWithStool = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: { plantId: 'reach_tier_plant', partName: 'leaf', subStageId: 'canopy_leaf', actions: 1 },
    });
    assert.equal(canopyWithStool.ok, true, 'canopy harvest should allow ground pool without ladder when ground actions remain');

    player.inventory.stacks = [{ itemId: 'tool:ladder', quantity: 1 }];
    elevatedGroundOnlyTick.actors.player.inventory.stacks = [{ itemId: 'tool:ladder', quantity: 1 }];
    const canopyWithLadder = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: { plantId: 'reach_tier_plant', partName: 'leaf', subStageId: 'canopy_leaf', actions: 1 },
    });
    assert.equal(canopyWithLadder.ok, true, 'ladder should satisfy canopy reach harvest requirement');
    assert.equal(canopyWithLadder.normalizedAction.payload.reachTier, 'canopy', 'harvest normalization should preserve reach tier metadata');
    assert.equal(canopyWithLadder.normalizedAction.payload.remainingActionsCanopy, 1, 'canopy validation should expose canopy pool metadata');

    const elevatedWithLadderTick = advanceTick(elevatedGroundOnlyTick, {
      actions: [
        {
          actionId: 'harvest-elevated-with-ladder',
          actorId: 'player',
          kind: 'harvest',
          issuedAtTick: 0,
          payload: { plantId: 'reach_tier_plant', partName: 'leaf', subStageId: 'elevated_leaf', actions: 1 },
        },
      ],
    });
    const elevatedAfterLadder = elevatedWithLadderTick.plants.reach_tier_plant.activeSubStages
      .find((entry) => entry.partName === 'leaf' && entry.subStageId === 'elevated_leaf');
    assert.equal(elevatedAfterLadder.remainingActionsGround, 0, 'ladder harvest should not recreate spent ground pool actions');
    assert.equal(elevatedAfterLadder.remainingActionsElevated, 1, 'ladder harvest should consume elevated pool action');

    const canopyCascadeTick = advanceTick(state, {
      actions: [
        {
          actionId: 'harvest-canopy-cascade',
          actorId: 'player',
          kind: 'harvest',
          issuedAtTick: 0,
          payload: { plantId: 'reach_tier_plant', partName: 'leaf', subStageId: 'canopy_leaf', actions: 3 },
        },
      ],
    });
    const canopyAfterCascade = canopyCascadeTick.plants.reach_tier_plant.activeSubStages
      .find((entry) => entry.partName === 'leaf' && entry.subStageId === 'canopy_leaf');
    assert.equal(canopyAfterCascade, undefined, 'canopy action should consume canopy, then elevated, then ground pools and deplete sub-stage');
  } finally {
    if (previousSpecies) {
      PLANT_BY_ID[speciesId] = previousSpecies;
    } else {
      delete PLANT_BY_ID[speciesId];
    }
  }
}

function runHarvestLegacyRemainingActionsMigrationTest() {
  const state = createInitialGameState(4272, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for legacy harvest migration checks');
  player.x = playerTile.x;
  player.y = playerTile.y;

  const speciesId = 'test_species_reach_tier_legacy';
  const previousSpecies = PLANT_BY_ID[speciesId];
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
            id: 'ground_leaf',
            reach_tier: 'ground',
            harvest_base_ticks: 2,
            harvest_tool_modifiers: {},
            harvest_yield: { units_per_action: [1, 1], actions_until_depleted: [3, 3] },
          },
          {
            id: 'elevated_leaf',
            reach_tier: 'elevated',
            harvest_base_ticks: 2,
            harvest_tool_modifiers: {},
            harvest_yield: {
              units_per_action: [1, 1],
              actions_until_depleted: [2, 2],
              ground_action_fraction: 0,
            },
          },
          {
            id: 'canopy_leaf',
            reach_tier: 'canopy',
            harvest_base_ticks: 2,
            harvest_tool_modifiers: {},
            harvest_yield: { units_per_action: [1, 1], actions_until_depleted: [2, 2], ground_action_fraction: 0.25 },
          },
        ],
      },
    ],
  };

  try {
    state.plants = {
      reach_tier_legacy_plant: {
        id: 'reach_tier_legacy_plant',
        speciesId,
        age: 90,
        x: playerTile.x,
        y: playerTile.y,
        stageName: 'mature',
        alive: true,
        vitality: 1,
        activeSubStages: [
          {
            partName: 'leaf',
            subStageId: 'ground_leaf',
            initialActionsRoll: 3,
            remainingActions: 3,
            harvestsThisSeason: 0,
            regrowthCountdown: null,
            vitalityDamageAppliedThisSeason: 0,
          },
          {
            partName: 'leaf',
            subStageId: 'elevated_leaf',
            initialActionsRoll: 2,
            remainingActions: 2,
            harvestsThisSeason: 0,
            regrowthCountdown: null,
            vitalityDamageAppliedThisSeason: 0,
          },
          {
            partName: 'leaf',
            subStageId: 'canopy_leaf',
            initialActionsRoll: 2,
            remainingActions: 2,
            harvestsThisSeason: 0,
            regrowthCountdown: null,
            vitalityDamageAppliedThisSeason: 0,
          },
        ],
        source: 'test',
      },
    };
    playerTile.plantIds = ['reach_tier_legacy_plant'];

    const groundValidation = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: { plantId: 'reach_tier_legacy_plant', partName: 'leaf', subStageId: 'ground_leaf', actions: 1 },
    });
    assert.equal(groundValidation.ok, true, 'legacy ground sub-stage should migrate remainingActions into ground pool');
    assert.equal(groundValidation.normalizedAction.payload.remainingActionsGround, 3, 'legacy ground migration should expose migrated ground pool');
    assert.equal(groundValidation.normalizedAction.payload.remainingActionsElevated, 0, 'legacy ground migration should keep elevated pool empty');

    const elevatedWithoutTool = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: { plantId: 'reach_tier_legacy_plant', partName: 'leaf', subStageId: 'elevated_leaf', actions: 1 },
    });
    assert.equal(elevatedWithoutTool.ok, false, 'legacy elevated sub-stage should still require stool/ladder when only elevated pool exists');
    assert.equal(elevatedWithoutTool.code, 'missing_required_tool', 'legacy elevated migration should report missing_required_tool without stool/ladder');

    player.inventory.stacks = [{ itemId: 'tool:stool', quantity: 1 }];
    const elevatedWithTool = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: { plantId: 'reach_tier_legacy_plant', partName: 'leaf', subStageId: 'elevated_leaf', actions: 1 },
    });
    assert.equal(elevatedWithTool.ok, true, 'legacy elevated sub-stage should be harvestable after stool migration path');
    assert.equal(elevatedWithTool.normalizedAction.payload.remainingActionsGround, 0, 'legacy elevated migration should keep migrated ground pool at zero');
    assert.equal(elevatedWithTool.normalizedAction.payload.remainingActionsElevated, 2, 'legacy elevated migration should expose migrated elevated pool');

    const canopyWithoutLadder = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: { plantId: 'reach_tier_legacy_plant', partName: 'leaf', subStageId: 'canopy_leaf', actions: 1 },
    });
    assert.equal(canopyWithoutLadder.ok, false, 'legacy canopy sub-stage should still require ladder');
    assert.equal(canopyWithoutLadder.requiredToolId, 'tool:ladder', 'legacy canopy migration should report ladder requirement');

    player.inventory.stacks = [{ itemId: 'tool:ladder', quantity: 1 }];
    const canopyWithLadder = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: { plantId: 'reach_tier_legacy_plant', partName: 'leaf', subStageId: 'canopy_leaf', actions: 1 },
    });
    assert.equal(canopyWithLadder.ok, true, 'legacy canopy sub-stage should migrate and validate with ladder');
    assert.equal(canopyWithLadder.normalizedAction.payload.remainingActionsCanopy, 2, 'legacy canopy migration should expose migrated canopy pool');

    const postHarvest = advanceTick(state, {
      actions: [
        {
          actionId: 'harvest-legacy-elevated',
          actorId: 'player',
          kind: 'harvest',
          issuedAtTick: 0,
          payload: { plantId: 'reach_tier_legacy_plant', partName: 'leaf', subStageId: 'elevated_leaf', actions: 1 },
        },
      ],
    });
    const elevatedEntry = postHarvest.plants.reach_tier_legacy_plant.activeSubStages
      .find((entry) => entry.partName === 'leaf' && entry.subStageId === 'elevated_leaf');
    assert.equal(elevatedEntry.remainingActionsGround, 0, 'legacy elevated harvest should not synthesize ground pool actions');
    assert.equal(elevatedEntry.remainingActionsElevated, 1, 'legacy elevated harvest should consume migrated elevated pool');
    assert.equal(elevatedEntry.remainingActions, 1, 'legacy elevated harvest should keep total remainingActions synchronized');

    const postCanopyHarvest = advanceTick(state, {
      actions: [
        {
          actionId: 'harvest-legacy-canopy',
          actorId: 'player',
          kind: 'harvest',
          issuedAtTick: 0,
          payload: { plantId: 'reach_tier_legacy_plant', partName: 'leaf', subStageId: 'canopy_leaf', actions: 1 },
        },
      ],
    });
    const canopyEntry = postCanopyHarvest.plants.reach_tier_legacy_plant.activeSubStages
      .find((entry) => entry.partName === 'leaf' && entry.subStageId === 'canopy_leaf');
    assert.equal(canopyEntry.remainingActionsCanopy, 1, 'legacy canopy harvest should consume migrated canopy pool');
  } finally {
    if (previousSpecies) {
      PLANT_BY_ID[speciesId] = previousSpecies;
    } else {
      delete PLANT_BY_ID[speciesId];
    }
  }
}

function runRaisedSleepingPlatformComfortBudgetBonusTest() {
  const state = createInitialGameState(4225, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;

  const afterBuild = advanceTick(state, {
    actions: [
      {
        actionId: 'build-raised-platform',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'raised_sleeping_platform' },
      },
    ],
  });

  assert.ok(
    afterBuild.camp.stationsUnlocked.includes('raised_sleeping_platform'),
    'building raised sleeping platform should unlock the comfort station',
  );
  assert.ok(
    Array.isArray(afterBuild.camp.comforts) && afterBuild.camp.comforts.includes('raised_sleeping_platform'),
    'building raised sleeping platform should mirror into camp comforts list',
  );

  const toNextDay = advanceTick(afterBuild, { idleTicks: 300 });
  assert.equal(toNextDay.dayTick, 0, 'advancing remaining day ticks should roll into a new day');

  assert.equal(
    toNextDay.actors.player.tickBudgetCurrent,
    210,
    'raised sleeping platform should grant +10 day-start budget to player',
  );
  assert.equal(
    toNextDay.actors.partner.tickBudgetCurrent,
    210,
    'raised sleeping platform should grant +10 day-start budget to partner',
  );
  assert.equal(
    toNextDay.actors.player.tickBudgetBase,
    200,
    'comfort bonus should apply at day-start reset without mutating intrinsic base budget',
  );
}

function runWindbreakReflectorWallPartnerBudgetBonusTest() {
  const state = createInitialGameState(4226, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;

  const afterBuild = advanceTick(state, {
    actions: [
      {
        actionId: 'build-windbreak',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'windbreak_reflector_wall' },
      },
    ],
  });

  assert.ok(
    afterBuild.camp.stationsUnlocked.includes('windbreak_reflector_wall'),
    'building windbreak should unlock the comfort station',
  );
  assert.ok(
    Array.isArray(afterBuild.camp.comforts) && afterBuild.camp.comforts.includes('windbreak_reflector_wall'),
    'building windbreak should mirror into camp comforts list',
  );

  const toNextDay = advanceTick(afterBuild, { idleTicks: 320 });
  assert.equal(toNextDay.dayTick, 0, 'advancing remaining day ticks should roll into a new day');

  assert.equal(
    toNextDay.actors.player.tickBudgetCurrent,
    200,
    'windbreak should not increase player day-start budget',
  );
  assert.equal(
    toNextDay.actors.partner.tickBudgetCurrent,
    210,
    'windbreak should increase partner day-start budget to reflect reduced maintenance load',
  );
}

function runWorkbenchToolCraftTickReductionTest() {
  const state = createInitialGameState(4227, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.actors.player.inventory.stacks = [
    { itemId: 'flint_cobble', quantity: 1 },
    { itemId: 'cordage', quantity: 1 },
  ];
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_station_workbench: true,
  };

  const afterBuild = advanceTick(state, {
    actions: [
      {
        actionId: 'build-workbench',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'workbench' },
      },
    ],
  });

  assert.ok(afterBuild.camp.stationsUnlocked.includes('workbench'), 'workbench should be unlocked after build action');

  const craftInCamp = advanceTick(afterBuild, {
    actions: [
      {
        actionId: 'craft-knife-in-camp',
        actorId: 'player',
        kind: 'tool_craft',
        payload: { recipeId: 'flint_knife' },
      },
    ],
  });

  const appliedInCamp = craftInCamp.currentDayActionLog.find((entry) => entry.actionId === 'craft-knife-in-camp');
  assert.ok(appliedInCamp && appliedInCamp.status === 'applied', 'in-camp tool craft should apply');
  assert.equal(appliedInCamp.tickCost, 24, 'workbench should reduce in-camp flint knife craft tick cost by 20%');

  const outOfCamp = {
    ...afterBuild,
    actors: {
      ...afterBuild.actors,
      player: {
        ...afterBuild.actors.player,
        x: 0,
        y: 0,
      },
    },
  };
  const validationOutOfCamp = validateAction(outOfCamp, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'flint_knife' },
  });
  assert.equal(validationOutOfCamp.ok, true, 'out-of-camp tool craft should still validate');
  assert.equal(validationOutOfCamp.normalizedAction.tickCost, 30, 'workbench bonus should not apply when neither in camp nor adjacent to workbench');

  const ax = afterBuild.camp.anchorX;
  const ay = afterBuild.camp.anchorY;
  const withWestEdgeWorkbench = {
    ...afterBuild,
    camp: {
      ...afterBuild.camp,
      stationPlacements: {
        ...afterBuild.camp.stationPlacements,
        workbench: { x: ax - 1, y: ay },
      },
    },
  };
  const adjacentOutsideCamp = {
    ...withWestEdgeWorkbench,
    actors: {
      ...withWestEdgeWorkbench.actors,
      player: {
        ...withWestEdgeWorkbench.actors.player,
        x: ax - 2,
        y: ay,
      },
    },
  };
  const validationAdjacentOutside = validateAction(adjacentOutsideCamp, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'flint_knife' },
  });
  assert.equal(validationAdjacentOutside.ok, true, 'adjacent tool craft should validate');
  assert.equal(
    validationAdjacentOutside.normalizedAction.tickCost,
    24,
    'workbench bonus should apply when adjacent to workbench even if not inside camp footprint',
  );
}

function runCarvedWoodenSpoutKnifeRequirementTest() {
  const state = createInitialGameState(4239, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;

  const missingKnife = validateAction(state, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'carved_wooden_spout' },
  });
  assert.equal(missingKnife.ok, false, 'carved_wooden_spout should require flint knife in inventory');
  assert.equal(missingKnife.code, 'missing_required_tool', 'missing knife should return missing_required_tool');

  state.actors.player.inventory.stacks = [
    { itemId: 'tool:flint_knife', quantity: 1 },
    { itemId: 'branch', quantity: 1 },
  ];
  const withKnife = validateAction(state, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'carved_wooden_spout' },
  });
  assert.equal(withKnife.ok, true, 'carved_wooden_spout should validate when flint knife is carried');
  assert.equal(
    withKnife.normalizedAction.payload.outputItemId,
    'tool:carved_wooden_spout',
    'carved_wooden_spout recipe should normalize deterministic output payload',
  );
}

function runCarvedWoodenSpoutCraftRuntimePreservesKnifeTest() {
  const state = createInitialGameState(4240, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.actors.player.inventory.stacks = [
    { itemId: 'tool:flint_knife', quantity: 1 },
    { itemId: 'branch', quantity: 1 },
  ];

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'craft-spout',
        actorId: 'player',
        kind: 'tool_craft',
        payload: { recipeId: 'carved_wooden_spout' },
      },
    ],
  });

  const logEntry = next.currentDayActionLog.find((entry) => entry.actionId === 'craft-spout');
  assert.ok(logEntry && logEntry.status === 'applied', 'carved_wooden_spout craft should apply with knife present');

  const spoutStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:carved_wooden_spout');
  assert.ok(spoutStack, 'carved_wooden_spout craft should add carved spout to inventory');
  assert.equal(spoutStack.quantity, 1, 'carved_wooden_spout craft should add one spout');

  const knifeStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:flint_knife');
  assert.ok(knifeStack, 'flint knife should remain in inventory after carved_wooden_spout craft');
  assert.equal(knifeStack.quantity, 1, 'flint knife should not be consumed by carved_wooden_spout craft');
}

function runBoneHookCraftValidationAndRuntimeTest() {
  const state = createInitialGameState(42401, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;

  const missingKnife = validateAction(state, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'bone_hook' },
  });
  assert.equal(missingKnife.ok, false, 'bone_hook should require flint knife in inventory');
  assert.equal(missingKnife.code, 'missing_required_tool', 'bone_hook without knife should return missing_required_tool');
  assert.equal(missingKnife.requiredToolId, 'tool:flint_knife', 'bone_hook without knife should report flint knife requirement');

  state.actors.player.inventory.stacks = [
    { itemId: 'tool:flint_knife', quantity: 1 },
    { itemId: 'sylvilagus_floridanus:bone', quantity: 1 },
    { itemId: 'sylvilagus_floridanus:bone', quantity: 1 },
  ];
  const withKnifeAndBone = validateAction(state, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'bone_hook' },
  });
  assert.equal(withKnifeAndBone.ok, true, 'bone_hook should validate when knife and bone material are carried');
  assert.equal(
    withKnifeAndBone.normalizedAction.payload.outputItemId,
    'tool:bone_hook',
    'bone_hook recipe should normalize deterministic output payload',
  );

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'craft-bone-hook',
        actorId: 'player',
        kind: 'tool_craft',
        payload: { recipeId: 'bone_hook' },
      },
    ],
  });

  const logEntry = next.currentDayActionLog.find((entry) => entry.actionId === 'craft-bone-hook');
  assert.ok(logEntry && logEntry.status === 'applied', 'bone_hook craft should apply with required materials and knife');

  const hookStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:bone_hook');
  assert.ok(hookStack, 'bone_hook craft should add tool:bone_hook to inventory');
  assert.equal(hookStack.quantity, 1, 'bone_hook craft should add one tool:bone_hook');

  const knifeStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:flint_knife');
  assert.ok(knifeStack, 'flint knife should remain in inventory after bone_hook craft');
  assert.equal(knifeStack.quantity, 1, 'flint knife should not be consumed by bone_hook craft');
}

function runReedyMaterialCraftAliasSupportTest() {
  const state = createInitialGameState(42403, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  unlockAllTechResearchForTests(state);

  const weavingSpeciesId = 'test_reedy_weaving_alias_species';
  const legacySpeciesId = 'test_reedy_legacy_alias_species';
  const previousWeaving = PLANT_BY_ID[weavingSpeciesId];
  const previousLegacy = PLANT_BY_ID[legacySpeciesId];
  PLANT_BY_ID[weavingSpeciesId] = {
    id: weavingSpeciesId,
    parts: [
      {
        name: 'stem',
        subStages: [{ id: 'raw', craft_tags: ['weaving_material'] }],
      },
    ],
  };
  PLANT_BY_ID[legacySpeciesId] = {
    id: legacySpeciesId,
    parts: [
      {
        name: 'stem',
        subStages: [{ id: 'raw', craft_tags: ['sun_hat_reed_material'] }],
      },
    ],
  };

  try {
    state.actors.player.inventory.stacks = [
      { itemId: `${weavingSpeciesId}:stem:raw`, quantity: 12 },
      { itemId: `${legacySpeciesId}:stem:raw`, quantity: 3 },
      { itemId: 'cordage', quantity: 12 },
    ];

    const basketWithWeavingAlias = validateAction(state, {
      actorId: 'player',
      kind: 'tool_craft',
      payload: { recipeId: 'basket' },
    });
    assert.equal(basketWithWeavingAlias.ok, true, 'basket should validate with weaving_material alias to reedy_material');

    const blickeyWithLegacyAlias = validateAction(state, {
      actorId: 'player',
      kind: 'tool_craft',
      payload: { recipeId: 'blickey' },
    });
    assert.equal(blickeyWithLegacyAlias.ok, true, 'blickey should validate with legacy sun_hat_reed_material alias to reedy_material');

    const leachingBasketWithLegacyAlias = validateAction(state, {
      actorId: 'player',
      kind: 'tool_craft',
      payload: { recipeId: 'leaching_basket' },
    });
    assert.equal(leachingBasketWithLegacyAlias.ok, true, 'leaching_basket should validate with legacy sun_hat_reed_material alias to reedy_material');
  } finally {
    if (previousWeaving) {
      PLANT_BY_ID[weavingSpeciesId] = previousWeaving;
    } else {
      delete PLANT_BY_ID[weavingSpeciesId];
    }
    if (previousLegacy) {
      PLANT_BY_ID[legacySpeciesId] = previousLegacy;
    } else {
      delete PLANT_BY_ID[legacySpeciesId];
    }
  }
}

function runLeachingBasketPlaceRetrieveAndProgressionTest() {
  const state = createInitialGameState(42404, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires a land tile for leaching basket lifecycle checks');
  const waterTile = findAdjacentTileMatching(state, landTile, (tile) => tile && !tile.rockType);
  assert.ok(waterTile, 'test requires an adjacent tile for leaching basket lifecycle checks');
  waterTile.waterType = 'river';
  waterTile.waterDepth = 'shallow';
  waterTile.waterFrozen = false;

  player.x = landTile.x;
  player.y = landTile.y;

  const speciesId = 'test_leaching_oak_species';
  const previousSpecies = PLANT_BY_ID[speciesId];
  PLANT_BY_ID[speciesId] = {
    id: speciesId,
    parts: [
      {
        name: 'acorn_kernel',
        subStages: [
          {
            id: 'raw',
            tannin_level: 0.8,
            craft_tags: [],
            processing_options: [],
          },
        ],
      },
    ],
  };

  try {
    player.inventory.stacks = [
      { itemId: 'tool:leaching_basket', quantity: 1, footprintW: 2, footprintH: 2 },
      { itemId: `${speciesId}:acorn_kernel:raw`, quantity: 2 },
    ];

    const placePreview = validateAction(state, {
      actorId: 'player',
      kind: 'leaching_basket_place',
      payload: {
        x: waterTile.x,
        y: waterTile.y,
        itemId: `${speciesId}:acorn_kernel:raw`,
        quantity: 2,
      },
    });
    assert.equal(placePreview.ok, true, 'leaching_basket_place should validate with basket, tannin source item, and adjacent water');

    const placed = advanceTick(state, {
      actions: [
        {
          actionId: 'place-leaching-basket',
          actorId: 'player',
          kind: 'leaching_basket_place',
          payload: {
            x: waterTile.x,
            y: waterTile.y,
            itemId: `${speciesId}:acorn_kernel:raw`,
            quantity: 2,
          },
        },
      ],
    });

    const placedWaterTile = getTileAt(placed, waterTile.x, waterTile.y);
    assert.ok(placedWaterTile?.leachingBasket?.active, 'placing leaching basket should create active tile state');
    assert.equal(
      Number(placedWaterTile.leachingBasket.tanninRemaining.toFixed(2)),
      0.8,
      'placed leaching basket should initialize tanninRemaining from source sub-stage tannin_level',
    );

    const afterOneDay = advanceDay(placed, 1);
    const afterOneDayTile = getTileAt(afterOneDay, waterTile.x, waterTile.y);
    assert.equal(
      Number(afterOneDayTile.leachingBasket.tanninRemaining.toFixed(2)),
      0.55,
      'river leaching basket should reduce tanninRemaining by 0.25 per day',
    );

    const retrievePreview = validateAction(afterOneDay, {
      actorId: 'player',
      kind: 'leaching_basket_retrieve',
      payload: { x: waterTile.x, y: waterTile.y },
    });
    assert.equal(retrievePreview.ok, true, 'leaching_basket_retrieve should validate on active leaching basket tile');

    const retrieved = advanceTick(afterOneDay, {
      actions: [
        {
          actionId: 'retrieve-leaching-basket',
          actorId: 'player',
          kind: 'leaching_basket_retrieve',
          payload: { x: waterTile.x, y: waterTile.y },
        },
      ],
    });
    const retrievedTile = getTileAt(retrieved, waterTile.x, waterTile.y);
    assert.equal(retrievedTile?.leachingBasket, null, 'leaching_basket_retrieve should clear tile state');
    const retrievedKernelStack = retrieved.actors.player.inventory.stacks.find((entry) => entry.itemId === `${speciesId}:acorn_kernel:raw`);
    assert.ok(retrievedKernelStack, 'leaching_basket_retrieve should return leached item stack to inventory');
    assert.equal(
      Number(retrievedKernelStack.tanninRemaining.toFixed(2)),
      0.55,
      'retrieved leached item stack should preserve tanninRemaining progress',
    );

    const payload = serializeGameState(retrieved);
    const loaded = deserializeGameState(payload);
    const loadedKernelStack = loaded.actors.player.inventory.stacks.find((entry) => entry.itemId === `${speciesId}:acorn_kernel:raw`);
    assert.ok(loadedKernelStack, 'snapshot round-trip should preserve leached item stack');
    assert.equal(
      Number(loadedKernelStack.tanninRemaining.toFixed(2)),
      0.55,
      'snapshot round-trip should preserve leached item tanninRemaining metadata',
    );
  } finally {
    if (previousSpecies) {
      PLANT_BY_ID[speciesId] = previousSpecies;
    } else {
      delete PLANT_BY_ID[speciesId];
    }
  }
}

function runSunHatCraftValidationAndRuntimeTest() {
  const state = createInitialGameState(42402, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  const temporaryReedItemId = 'test:sun_hat_reed_bundle';
  const previousTemporaryItem = ITEM_BY_ID[temporaryReedItemId];
  ITEM_BY_ID[temporaryReedItemId] = {
    id: temporaryReedItemId,
    name: 'Test Reed Bundle',
    category: 'intermediate',
    unit_weight_g: 1,
    decay_days: null,
    can_dry: true,
    can_freeze: true,
    craft_tags: ['reedy_material'],
    nutrition: null,
  };

  try {
    const missingMaterials = validateAction(state, {
      actorId: 'player',
      kind: 'tool_craft',
      payload: { recipeId: 'sun_hat' },
    });
    assert.equal(missingMaterials.ok, false, 'sun_hat should require either reed-weave materials or dried_hide plus cordage');
    assert.ok(
      missingMaterials.code === 'missing_craft_material' || missingMaterials.code === 'insufficient_item_quantity',
      'sun_hat with no materials should fail with a missing-material code',
    );

    state.actors.player.inventory.stacks = [
      { itemId: 'dried_hide', quantity: 1 },
      { itemId: 'cordage', quantity: 2 },
    ];
    const withHidePath = validateAction(state, {
      actorId: 'player',
      kind: 'tool_craft',
      payload: { recipeId: 'sun_hat' },
    });
    assert.equal(withHidePath.ok, true, 'sun_hat should validate with dried_hide and cordage path');
    assert.equal(
      withHidePath.normalizedAction.payload.outputItemId,
      'tool:sun_hat',
      'sun_hat recipe should normalize deterministic output payload',
    );

    state.actors.player.inventory.stacks = [
      { itemId: temporaryReedItemId, quantity: 6 },
      { itemId: 'cordage', quantity: 2 },
    ];
    const withReedTagPath = validateAction(state, {
      actorId: 'player',
      kind: 'tool_craft',
      payload: { recipeId: 'sun_hat' },
    });
    assert.equal(withReedTagPath.ok, true, 'sun_hat should validate with reed-weave craft tag materials and cordage');

    const crafted = advanceTick(state, {
      actions: [
        {
          actionId: 'craft-sun-hat',
          actorId: 'player',
          kind: 'tool_craft',
          payload: { recipeId: 'sun_hat' },
        },
      ],
    });

    const logEntry = crafted.currentDayActionLog.find((entry) => entry.actionId === 'craft-sun-hat');
    assert.ok(logEntry && logEntry.status === 'applied', 'sun_hat craft should apply with valid tagged materials');

    const hatStack = crafted.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:sun_hat');
    assert.ok(hatStack, 'sun_hat craft should add tool:sun_hat to inventory');
    assert.equal(hatStack.quantity, 1, 'sun_hat craft should add one tool:sun_hat');
  } finally {
    if (previousTemporaryItem) {
      ITEM_BY_ID[temporaryReedItemId] = previousTemporaryItem;
    } else {
      delete ITEM_BY_ID[temporaryReedItemId];
    }
  }
}

function runWorkbenchSpoutCraftTickReductionTest() {
  const state = createInitialGameState(4241, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_station_workbench: true,
  };

  const afterBuild = advanceTick(state, {
    actions: [
      {
        actionId: 'build-workbench-for-spout',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'workbench' },
      },
    ],
  });
  assert.ok(afterBuild.camp.stationsUnlocked.includes('workbench'), 'workbench should be built for spout craft tick test');

  const withKnife = {
    ...afterBuild,
    actors: {
      ...afterBuild.actors,
      player: {
        ...afterBuild.actors.player,
        inventory: {
          ...(afterBuild.actors.player.inventory || {}),
          stacks: [
            { itemId: 'tool:flint_knife', quantity: 1 },
            { itemId: 'branch', quantity: 1 },
          ],
        },
      },
    },
  };

  const inCamp = advanceTick(withKnife, {
    actions: [
      {
        actionId: 'craft-spout-in-camp',
        actorId: 'player',
        kind: 'tool_craft',
        payload: { recipeId: 'carved_wooden_spout' },
      },
    ],
  });
  const inCampLog = inCamp.currentDayActionLog.find((entry) => entry.actionId === 'craft-spout-in-camp');
  assert.ok(inCampLog && inCampLog.status === 'applied', 'in-camp carved_wooden_spout craft should apply');
  assert.equal(inCampLog.tickCost, 12, 'workbench should reduce carved_wooden_spout craft tick cost by 20% in camp');

  const outOfCamp = {
    ...withKnife,
    actors: {
      ...withKnife.actors,
      player: {
        ...withKnife.actors.player,
        x: 0,
        y: 0,
      },
    },
  };
  const outOfCampValidation = validateAction(outOfCamp, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId: 'carved_wooden_spout' },
  });
  assert.equal(outOfCampValidation.ok, true, 'out-of-camp carved_wooden_spout craft should validate when knife is present');
  assert.equal(
    outOfCampValidation.normalizedAction.tickCost,
    15,
    'workbench bonus should not apply when neither in camp nor adjacent to workbench for carved_wooden_spout craft',
  );
}

function addMatureTappableWalnutToTile(state, tile, plantId = 'test_tappable_walnut') {
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

function findAdjacentLandTile(state, originTile) {
  if (!originTile) {
    return null;
  }
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const x = originTile.x + dx;
      const y = originTile.y + dy;
      if (x < 0 || y < 0 || x >= state.width || y >= state.height) {
        continue;
      }
      const tile = state.tiles[y * state.width + x];
      if (tile && !tile.waterType && !tile.rockType) {
        return tile;
      }
    }
  }
  return null;
}

function findFarLandTile(state, originTile) {
  return state.tiles.find((tile) => (
    tile
    && !tile.waterType
    && !tile.rockType
    && (Math.abs(tile.x - originTile.x) > 1 || Math.abs(tile.y - originTile.y) > 1)
  )) || null;
}

function findCardinalAdjacentWaterLandTile(state) {
  const offsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const tile of state.tiles || []) {
    if (!tile || tile.waterType || tile.rockType) {
      continue;
    }
    for (const [dx, dy] of offsets) {
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) {
        continue;
      }
      const adjacent = state.tiles[ny * state.width + nx];
      if (adjacent?.waterType && adjacent.waterFrozen !== true) {
        return tile;
      }
    }
  }
  return null;
}

function runTapInsertSpoutValidationRulesTest() {
  const state = createInitialGameState(4242, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile for tap_insert_spout validation');
  player.x = landTile.x;
  player.y = landTile.y;
  addMatureTappableWalnutToTile(state, landTile);

  const missingKnife = validateAction(state, {
    actorId: 'player',
    kind: 'tap_insert_spout',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(missingKnife.ok, false, 'tap_insert_spout should require knife in inventory');
  assert.equal(missingKnife.code, 'missing_required_tool', 'missing knife should return missing_required_tool');

  player.inventory.stacks = [{ itemId: 'tool:flint_knife', quantity: 1 }];
  const missingSpout = validateAction(state, {
    actorId: 'player',
    kind: 'tap_insert_spout',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(missingSpout.ok, false, 'tap_insert_spout should require carved spout in inventory');
  assert.equal(missingSpout.code, 'insufficient_item_quantity', 'missing spout should return insufficient_item_quantity');

  player.inventory.stacks = [
    { itemId: 'tool:flint_knife', quantity: 1 },
    { itemId: 'tool:carved_wooden_spout', quantity: 1 },
  ];
  const valid = validateAction(state, {
    actorId: 'player',
    kind: 'tap_insert_spout',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(valid.ok, true, 'tap_insert_spout should validate with knife and carved spout on tappable tree tile');
  assert.equal(valid.normalizedAction.tickCost, 2, 'tap_insert_spout should normalize to 2 tick cost');

  landTile.sapTap = { hasSpout: true, insertedDay: 0, insertedDayTick: 0 };
  const duplicate = validateAction(state, {
    actorId: 'player',
    kind: 'tap_insert_spout',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(duplicate.ok, false, 'tap_insert_spout should reject duplicate insertion on same tile');
  assert.equal(duplicate.code, 'tap_insert_spout_already_present', 'duplicate insertion should return tap_insert_spout_already_present');
}

function runTapInsertSpoutInvalidTargetTileTest() {
  const state = createInitialGameState(4243, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile for invalid tap_insert_spout target');
  player.x = landTile.x;
  player.y = landTile.y;
  player.inventory.stacks = [
    { itemId: 'tool:flint_knife', quantity: 1 },
    { itemId: 'tool:carved_wooden_spout', quantity: 1 },
  ];

  const invalidTarget = validateAction(state, {
    actorId: 'player',
    kind: 'tap_insert_spout',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(invalidTarget.ok, false, 'tap_insert_spout should reject tiles without tappable mature trees');
  assert.equal(invalidTarget.code, 'tap_insert_spout_invalid_target', 'invalid tree tile should return tap_insert_spout_invalid_target');
}

function runTapInsertSpoutRuntimeAndBudgetTest() {
  const state = createInitialGameState(4244, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile for tap_insert_spout runtime');
  player.x = landTile.x;
  player.y = landTile.y;
  addMatureTappableWalnutToTile(state, landTile);
  player.inventory.stacks = [
    { itemId: 'tool:flint_knife', quantity: 1 },
    { itemId: 'tool:carved_wooden_spout', quantity: 2 },
  ];

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'tap-insert-spout',
        actorId: 'player',
        kind: 'tap_insert_spout',
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const logEntry = next.currentDayActionLog.find((entry) => entry.actionId === 'tap-insert-spout');
  assert.ok(logEntry && logEntry.status === 'applied', 'tap_insert_spout should be applied');
  assert.equal(logEntry.tickCost, 2, 'tap_insert_spout should consume 2 ticks');
  assert.equal(next.dayTick, 2, 'tap_insert_spout should advance dayTick by 2');
  assert.equal(next.actors.player.tickBudgetCurrent, 198, 'tap_insert_spout should consume 2 actor budget ticks');

  const updatedTile = next.tiles[landTile.y * next.width + landTile.x];
  assert.ok(updatedTile.sapTap && updatedTile.sapTap.hasSpout === true, 'tap_insert_spout should set tile sapTap.hasSpout');
  assert.equal(updatedTile.sapTap.insertedDayTick, 0, 'tap_insert_spout should record insertion tick before time advances');

  const remainingSpout = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:carved_wooden_spout');
  assert.ok(remainingSpout, 'tap_insert_spout should keep remaining carved spout stack after consuming one');
  assert.equal(remainingSpout.quantity, 1, 'tap_insert_spout should consume exactly one carved spout');

  const knifeStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:flint_knife');
  assert.ok(knifeStack, 'tap_insert_spout should not consume flint knife');
  assert.equal(knifeStack.quantity, 1, 'tap_insert_spout should preserve flint knife quantity');
}

function runTapInsertSpoutAdjacentAndOutOfRangeTest() {
  const state = createInitialGameState(4246, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires a player land tile for tap_insert_spout adjacency checks');
  const adjacentTile = findAdjacentLandTile(state, playerTile);
  assert.ok(adjacentTile, 'test requires an adjacent land tile for tap_insert_spout adjacency checks');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires a far land tile for tap_insert_spout range rejection');

  player.x = playerTile.x;
  player.y = playerTile.y;
  player.inventory.stacks = [
    { itemId: 'tool:flint_knife', quantity: 1 },
    { itemId: 'tool:carved_wooden_spout', quantity: 2 },
  ];
  addMatureTappableWalnutToTile(state, adjacentTile, 'adjacent_tappable_walnut');
  addMatureTappableWalnutToTile(state, farTile, 'far_tappable_walnut');

  const adjacentValidation = validateAction(state, {
    actorId: 'player',
    kind: 'tap_insert_spout',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(adjacentValidation.ok, true, 'tap_insert_spout should validate for adjacent target tile');

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'tap_insert_spout',
    payload: { x: farTile.x, y: farTile.y },
  });
  assert.equal(farValidation.ok, false, 'tap_insert_spout should reject far target tile');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'far tap_insert_spout target should return interaction_out_of_range');
}

function runTapRemoveSpoutValidationRulesTest() {
  const state = createInitialGameState(4252, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires a player land tile for tap_remove_spout validation');
  const adjacentTile = findAdjacentLandTile(state, playerTile);
  assert.ok(adjacentTile, 'test requires an adjacent land tile for tap_remove_spout validation');

  player.x = playerTile.x;
  player.y = playerTile.y;
  adjacentTile.sapTap = {
    hasSpout: true,
    insertedDay: 4,
    insertedDayTick: 12,
  };

  const valid = validateAction(state, {
    actorId: 'player',
    kind: 'tap_remove_spout',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(valid.ok, true, 'tap_remove_spout should validate when adjacent target has an inserted spout');
  assert.equal(valid.normalizedAction.tickCost, 1, 'tap_remove_spout should normalize to 1 tick cost');

  const missingSpout = validateAction(state, {
    actorId: 'player',
    kind: 'tap_remove_spout',
    payload: { x: playerTile.x, y: playerTile.y },
  });
  assert.equal(missingSpout.ok, false, 'tap_remove_spout should reject target tiles without inserted spout');
  assert.equal(missingSpout.code, 'tap_remove_spout_missing_spout', 'missing spout should return tap_remove_spout_missing_spout');
}

function runTapRemoveSpoutOutOfRangeTest() {
  const state = createInitialGameState(4253, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires a player land tile for tap_remove_spout range rejection');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires a far land tile for tap_remove_spout range rejection');

  player.x = playerTile.x;
  player.y = playerTile.y;
  farTile.sapTap = {
    hasSpout: true,
    insertedDay: 2,
    insertedDayTick: 9,
  };

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'tap_remove_spout',
    payload: { x: farTile.x, y: farTile.y },
  });
  assert.equal(farValidation.ok, false, 'tap_remove_spout should reject far target tile');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'far tap_remove_spout target should return interaction_out_of_range');
}

function runTapRemoveSpoutRuntimeAndBudgetTest() {
  const state = createInitialGameState(4254, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile for tap_remove_spout runtime');

  player.x = landTile.x;
  player.y = landTile.y;
  player.inventory.stacks = [{ itemId: 'tool:carved_wooden_spout', quantity: 2 }];
  landTile.sapTap = {
    hasSpout: true,
    insertedDay: 6,
    insertedDayTick: 33,
  };

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'tap-remove-spout',
        actorId: 'player',
        kind: 'tap_remove_spout',
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const logEntry = next.currentDayActionLog.find((entry) => entry.actionId === 'tap-remove-spout');
  assert.ok(logEntry && logEntry.status === 'applied', 'tap_remove_spout should be applied');
  assert.equal(logEntry.tickCost, 1, 'tap_remove_spout should consume 1 tick');
  assert.equal(next.dayTick, 1, 'tap_remove_spout should advance dayTick by 1');
  assert.equal(next.actors.player.tickBudgetCurrent, 199, 'tap_remove_spout should consume 1 actor budget tick');

  const updatedTile = next.tiles[landTile.y * next.width + landTile.x];
  assert.equal(updatedTile.sapTap, null, 'tap_remove_spout should clear tile sapTap state');

  const spoutStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:carved_wooden_spout');
  assert.ok(spoutStack, 'tap_remove_spout should return a carved wooden spout to inventory');
  assert.equal(spoutStack.quantity, 3, 'tap_remove_spout should return exactly one carved wooden spout');
}

function runTapPlaceVesselValidationRulesTest() {
  const state = createInitialGameState(4255, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires a player land tile for tap_place_vessel validation');
  const adjacentTile = findAdjacentLandTile(state, playerTile);
  assert.ok(adjacentTile, 'test requires an adjacent land tile for tap_place_vessel validation');

  player.x = playerTile.x;
  player.y = playerTile.y;
  adjacentTile.sapTap = {
    hasSpout: true,
    insertedDay: 4,
    insertedDayTick: 12,
  };

  const missingVessel = validateAction(state, {
    actorId: 'player',
    kind: 'tap_place_vessel',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(missingVessel.ok, false, 'tap_place_vessel should require hide pitch vessel in inventory');
  assert.equal(missingVessel.code, 'insufficient_item_quantity', 'missing vessel should return insufficient_item_quantity');

  player.inventory.stacks = [{ itemId: 'tool:hide_pitch_vessel', quantity: 1 }];
  const valid = validateAction(state, {
    actorId: 'player',
    kind: 'tap_place_vessel',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(valid.ok, true, 'tap_place_vessel should validate when adjacent target has inserted spout and vessel inventory');
  assert.equal(valid.normalizedAction.tickCost, 1, 'tap_place_vessel should normalize to 1 tick cost');

  const noSpout = validateAction(state, {
    actorId: 'player',
    kind: 'tap_place_vessel',
    payload: { x: playerTile.x, y: playerTile.y },
  });
  assert.equal(noSpout.ok, false, 'tap_place_vessel should reject target tiles without inserted spout');
  assert.equal(noSpout.code, 'tap_place_vessel_missing_spout', 'missing spout should return tap_place_vessel_missing_spout');

  adjacentTile.sapTap.hasVessel = true;
  const duplicate = validateAction(state, {
    actorId: 'player',
    kind: 'tap_place_vessel',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(duplicate.ok, false, 'tap_place_vessel should reject duplicate vessel placement');
  assert.equal(duplicate.code, 'tap_place_vessel_already_present', 'duplicate vessel placement should return tap_place_vessel_already_present');
}

function runTapPlaceVesselOutOfRangeTest() {
  const state = createInitialGameState(4256, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires a player land tile for tap_place_vessel range rejection');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires a far land tile for tap_place_vessel range rejection');

  player.x = playerTile.x;
  player.y = playerTile.y;
  player.inventory.stacks = [{ itemId: 'tool:hide_pitch_vessel', quantity: 1 }];
  farTile.sapTap = {
    hasSpout: true,
    insertedDay: 2,
    insertedDayTick: 9,
  };

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'tap_place_vessel',
    payload: { x: farTile.x, y: farTile.y },
  });
  assert.equal(farValidation.ok, false, 'tap_place_vessel should reject far target tile');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'far tap_place_vessel target should return interaction_out_of_range');
}

function runTapPlaceVesselRuntimeAndBudgetTest() {
  const state = createInitialGameState(4257, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile for tap_place_vessel runtime');

  player.x = landTile.x;
  player.y = landTile.y;
  player.inventory.stacks = [{ itemId: 'tool:hide_pitch_vessel', quantity: 2 }];
  landTile.sapTap = {
    hasSpout: true,
    insertedDay: 6,
    insertedDayTick: 33,
  };

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'tap-place-vessel',
        actorId: 'player',
        kind: 'tap_place_vessel',
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const logEntry = next.currentDayActionLog.find((entry) => entry.actionId === 'tap-place-vessel');
  assert.ok(logEntry && logEntry.status === 'applied', 'tap_place_vessel should be applied');
  assert.equal(logEntry.tickCost, 1, 'tap_place_vessel should consume 1 tick');
  assert.equal(next.dayTick, 1, 'tap_place_vessel should advance dayTick by 1');
  assert.equal(next.actors.player.tickBudgetCurrent, 199, 'tap_place_vessel should consume 1 actor budget tick');

  const updatedTile = next.tiles[landTile.y * next.width + landTile.x];
  assert.ok(updatedTile.sapTap && updatedTile.sapTap.hasVessel === true, 'tap_place_vessel should attach vessel to sapTap');
  assert.equal(updatedTile.sapTap.vesselPlacedDayTick, 0, 'tap_place_vessel should record vessel placement tick before time advances');
  assert.equal(updatedTile.sapTap.vesselSapUnits, 0, 'tap_place_vessel should initialize vessel sap units to zero');
  assert.equal(updatedTile.sapTap.vesselCapacityUnits, 10, 'tap_place_vessel should initialize vessel capacity units');

  const vesselStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:hide_pitch_vessel');
  assert.ok(vesselStack, 'tap_place_vessel should keep remaining vessel stack after consuming one');
  assert.equal(vesselStack.quantity, 1, 'tap_place_vessel should consume exactly one hide pitch vessel');
}

function runTapRetrieveVesselValidationRulesTest() {
  const state = createInitialGameState(4261, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires a player land tile for tap_retrieve_vessel validation');
  const adjacentTile = findAdjacentLandTile(state, playerTile);
  assert.ok(adjacentTile, 'test requires an adjacent land tile for tap_retrieve_vessel validation');

  player.x = playerTile.x;
  player.y = playerTile.y;
  adjacentTile.sapTap = {
    hasSpout: true,
    insertedDay: 4,
    insertedDayTick: 12,
    hasVessel: false,
  };

  const missingVessel = validateAction(state, {
    actorId: 'player',
    kind: 'tap_retrieve_vessel',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(missingVessel.ok, false, 'tap_retrieve_vessel should require attached vessel on target tile');
  assert.equal(missingVessel.code, 'tap_retrieve_vessel_missing_vessel', 'missing vessel should return tap_retrieve_vessel_missing_vessel');

  adjacentTile.sapTap.hasVessel = true;
  const valid = validateAction(state, {
    actorId: 'player',
    kind: 'tap_retrieve_vessel',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(valid.ok, true, 'tap_retrieve_vessel should validate when adjacent target has attached vessel');
  assert.equal(valid.normalizedAction.tickCost, 1, 'tap_retrieve_vessel should normalize to 1 tick cost');
}

function runTapRetrieveVesselOutOfRangeTest() {
  const state = createInitialGameState(4262, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires a player land tile for tap_retrieve_vessel range rejection');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires a far land tile for tap_retrieve_vessel range rejection');

  player.x = playerTile.x;
  player.y = playerTile.y;
  farTile.sapTap = {
    hasSpout: true,
    insertedDay: 3,
    insertedDayTick: 8,
    hasVessel: true,
    vesselPlacedDay: 3,
    vesselPlacedDayTick: 8,
    vesselSapUnits: 2,
    vesselCapacityUnits: 10,
  };

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'tap_retrieve_vessel',
    payload: { x: farTile.x, y: farTile.y },
  });
  assert.equal(farValidation.ok, false, 'tap_retrieve_vessel should reject far target tile');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'far tap_retrieve_vessel target should return interaction_out_of_range');
}

function runTapRetrieveVesselRuntimeAndBudgetTest() {
  const state = createInitialGameState(4263, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile for tap_retrieve_vessel runtime');

  player.x = landTile.x;
  player.y = landTile.y;
  player.inventory.stacks = [{ itemId: 'tool:hide_pitch_vessel', quantity: 1 }];
  landTile.sapTap = {
    hasSpout: true,
    insertedDay: 6,
    insertedDayTick: 33,
    hasVessel: true,
    vesselPlacedDay: 6,
    vesselPlacedDayTick: 33,
    vesselSapUnits: 4,
    vesselCapacityUnits: 10,
  };

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'tap-retrieve-vessel',
        actorId: 'player',
        kind: 'tap_retrieve_vessel',
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const logEntry = next.currentDayActionLog.find((entry) => entry.actionId === 'tap-retrieve-vessel');
  assert.ok(logEntry && logEntry.status === 'applied', 'tap_retrieve_vessel should be applied');
  assert.equal(logEntry.tickCost, 1, 'tap_retrieve_vessel should consume 1 tick');
  assert.equal(next.dayTick, 1, 'tap_retrieve_vessel should advance dayTick by 1');
  assert.equal(next.actors.player.tickBudgetCurrent, 199, 'tap_retrieve_vessel should consume 1 actor budget tick');

  const updatedTile = next.tiles[landTile.y * next.width + landTile.x];
  assert.ok(updatedTile.sapTap && updatedTile.sapTap.hasSpout === true, 'tap_retrieve_vessel should preserve inserted spout state');
  assert.equal(updatedTile.sapTap.hasVessel, false, 'tap_retrieve_vessel should detach vessel from sap tap');
  assert.equal(updatedTile.sapTap.vesselSapUnits, null, 'tap_retrieve_vessel should clear vessel sap units on tile');

  const vesselStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:hide_pitch_vessel');
  assert.ok(vesselStack, 'tap_retrieve_vessel should preserve original empty vessel already in inventory');
  assert.equal(vesselStack.quantity, 1, 'tap_retrieve_vessel should not return an additional empty vessel when sap was collected');

  const filledVesselStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:hide_pitch_vessel_filled_sap');
  assert.ok(filledVesselStack, 'tap_retrieve_vessel should return a sap-filled vessel container when sap was collected');
  assert.equal(filledVesselStack.quantity, 1, 'tap_retrieve_vessel should return exactly one sap-filled vessel container');

  const sapStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'sap_raw');
  assert.equal(sapStack, undefined, 'tap_retrieve_vessel should not create loose sap inventory stacks');
}

function runSapTapDailyFillProgressionTest() {
  const state = createInitialGameState(4258, { width: 30, height: 30 });
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile for sap tap fill progression');

  landTile.sapTap = {
    hasSpout: true,
    insertedDay: 1,
    insertedDayTick: 0,
    hasVessel: true,
    vesselPlacedDay: 1,
    vesselPlacedDayTick: 0,
    vesselSapUnits: 0,
    vesselCapacityUnits: 10,
  };

  const next = advanceDay(state, 1);
  const updatedTile = next.tiles[landTile.y * next.width + landTile.x];
  assert.equal(updatedTile.sapTap.vesselSapUnits, 1, 'sap tap with spout and vessel should fill by one unit per day');
}

function runSapTapDailyFillGuardsTest() {
  const state = createInitialGameState(4259, { width: 30, height: 30 });
  const landTiles = state.tiles.filter((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTiles.length >= 2, 'test requires at least two land tiles for sap tap fill guard checks');
  const spoutOnlyTile = landTiles[0];
  const vesselOnlyTile = landTiles[1];

  spoutOnlyTile.sapTap = {
    hasSpout: true,
    insertedDay: 2,
    insertedDayTick: 10,
    hasVessel: false,
    vesselSapUnits: 0,
    vesselCapacityUnits: 10,
  };
  vesselOnlyTile.sapTap = {
    hasSpout: false,
    hasVessel: true,
    vesselPlacedDay: 2,
    vesselPlacedDayTick: 10,
    vesselSapUnits: 3,
    vesselCapacityUnits: 10,
  };

  const next = advanceDay(state, 1);
  const nextSpoutOnlyTile = next.tiles[spoutOnlyTile.y * next.width + spoutOnlyTile.x];
  const nextVesselOnlyTile = next.tiles[vesselOnlyTile.y * next.width + vesselOnlyTile.x];
  assert.equal(nextSpoutOnlyTile.sapTap.vesselSapUnits, 0, 'sap tap should not fill when vessel is missing');
  assert.equal(nextVesselOnlyTile.sapTap.vesselSapUnits, 3, 'sap tap should not fill when spout is missing');
}

function runSapTapDailyFillCapacityClampTest() {
  const state = createInitialGameState(4260, { width: 30, height: 30 });
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile for sap tap capacity clamp');

  landTile.sapTap = {
    hasSpout: true,
    insertedDay: 5,
    insertedDayTick: 7,
    hasVessel: true,
    vesselPlacedDay: 5,
    vesselPlacedDayTick: 7,
    vesselSapUnits: 9,
    vesselCapacityUnits: 10,
  };

  const next = advanceDay(state, 3);
  const updatedTile = next.tiles[landTile.y * next.width + landTile.x];
  assert.equal(updatedTile.sapTap.vesselSapUnits, 10, 'sap tap fill should clamp at vessel capacity');
}

function runDigAdjacentAndOutOfRangeValidationTest() {
  const state = createInitialGameState(4247, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires a player land tile for dig adjacency checks');
  const adjacentTile = findAdjacentLandTile(state, playerTile);
  assert.ok(adjacentTile, 'test requires an adjacent land tile for dig adjacency checks');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires a far land tile for dig range rejection');

  player.x = playerTile.x;
  player.y = playerTile.y;

  const adjacentValidation = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(adjacentValidation.ok, true, 'dig should validate on adjacent tile');

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { x: farTile.x, y: farTile.y },
  });
  assert.equal(farValidation.ok, false, 'dig should reject far target tile');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'far dig target should return interaction_out_of_range');
}

function runHoeAdjacentAndOutOfRangeValidationTest() {
  const state = createInitialGameState(4248, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires a player land tile for hoe adjacency checks');
  const adjacentTile = findAdjacentLandTile(state, playerTile);
  assert.ok(adjacentTile, 'test requires an adjacent land tile for hoe adjacency checks');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires a far land tile for hoe range rejection');

  player.x = playerTile.x;
  player.y = playerTile.y;
  if (!Array.isArray(player.inventory?.stacks)) {
    player.inventory.stacks = [];
  }
  player.inventory.stacks.push({ itemId: 'tool:hoe', quantity: 1 });

  const adjacentValidation = validateAction(state, {
    actorId: 'player',
    kind: 'hoe',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(adjacentValidation.ok, true, 'hoe should validate on adjacent tile');

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'hoe',
    payload: { x: farTile.x, y: farTile.y },
  });
  assert.equal(farValidation.ok, false, 'hoe should reject far target tile');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'far hoe target should return interaction_out_of_range');
}

function runInspectAdjacentAndOutOfRangeValidationTest() {
  const state = createInitialGameState(4249, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires a player land tile for inspect adjacency checks');
  const adjacentTile = findAdjacentLandTile(state, playerTile);
  assert.ok(adjacentTile, 'test requires an adjacent land tile for inspect adjacency checks');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires a far land tile for inspect range rejection');

  player.x = playerTile.x;
  player.y = playerTile.y;

  const adjacentValidation = validateAction(state, {
    actorId: 'player',
    kind: 'inspect',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(adjacentValidation.ok, true, 'inspect should validate on adjacent tile');

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'inspect',
    payload: { x: farTile.x, y: farTile.y },
  });
  assert.equal(farValidation.ok, false, 'inspect should reject far target tile');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'far inspect target should return interaction_out_of_range');
}

function runHarvestCacheAdjacentAndOutOfRangeValidationTest() {
  const state = createInitialGameState(4250, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires a player land tile for harvest adjacency checks');
  const adjacentTile = findAdjacentLandTile(state, playerTile);
  assert.ok(adjacentTile, 'test requires an adjacent land tile for harvest adjacency checks');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires a far land tile for harvest range rejection');

  player.x = playerTile.x;
  player.y = playerTile.y;
  adjacentTile.squirrelCache = {
    cachedSpeciesId: 'juglans_nigra',
    cachedPartName: 'husked_nut',
    cachedSubStageId: 'whole',
    nutContentGrams: 150,
    placementType: 'ground',
    discovered: true,
  };
  farTile.squirrelCache = {
    cachedSpeciesId: 'juglans_nigra',
    cachedPartName: 'husked_nut',
    cachedSubStageId: 'whole',
    nutContentGrams: 150,
    placementType: 'ground',
    discovered: true,
  };

  const adjacentValidation = validateAction(state, {
    actorId: 'player',
    kind: 'harvest',
    payload: { x: adjacentTile.x, y: adjacentTile.y, cacheGrams: 100 },
  });
  assert.equal(adjacentValidation.ok, true, 'squirrel-cache harvest should validate on adjacent tile');

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'harvest',
    payload: { x: farTile.x, y: farTile.y, cacheGrams: 100 },
  });
  assert.equal(farValidation.ok, false, 'squirrel-cache harvest should reject far target tile');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'far squirrel-cache harvest should return interaction_out_of_range');
}

function runHarvestPlantIdRangeUnchangedTest() {
  const state = createInitialGameState(4251, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires a player land tile for plantId harvest range check');
  const adjacentTile = findAdjacentLandTile(state, playerTile);
  assert.ok(adjacentTile, 'test requires an adjacent land tile for plantId harvest range check');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires a far land tile for plantId harvest range check');

  player.x = playerTile.x;
  player.y = playerTile.y;
  state.plants.range_check_plant = {
    id: 'range_check_plant',
    speciesId: 'daucus_carota',
    age: 10,
    x: adjacentTile.x,
    y: adjacentTile.y,
    stageName: 'first_year_vegetative',
    alive: true,
    vitality: 1,
    activeSubStages: [{ partName: 'root', subStageId: 'first_year', digRevealTicksApplied: 5 }],
    source: 'test',
  };
  adjacentTile.plantIds = ['range_check_plant'];
  adjacentTile.disturbed = true;

  const validationAdjacent = validateAction(state, {
    actorId: 'player',
    kind: 'harvest',
    payload: {
      plantId: 'range_check_plant',
      partName: 'root',
      subStageId: 'first_year',
      actions: 1,
    },
  });
  assert.equal(validationAdjacent.ok, true, 'plantId harvest should validate when plant is on an adjacent tile');

  state.plants.range_check_plant.x = farTile.x;
  state.plants.range_check_plant.y = farTile.y;
  adjacentTile.plantIds = [];
  farTile.plantIds = ['range_check_plant'];
  farTile.disturbed = true;

  const validationFar = validateAction(state, {
    actorId: 'player',
    kind: 'harvest',
    payload: {
      plantId: 'range_check_plant',
      partName: 'root',
      subStageId: 'first_year',
      actions: 1,
    },
  });
  assert.equal(validationFar.ok, false, 'plantId harvest should reject non-adjacent plant tiles');
  assert.equal(validationFar.code, 'interaction_out_of_range', 'non-adjacent plantId harvest should return interaction_out_of_range');
}

function runTrapPlaceSnareValidationRulesTest() {
  const state = createInitialGameState(4272, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for trap_place_snare validation');
  const adjacentTile = findAdjacentLandTile(state, playerTile);
  assert.ok(adjacentTile, 'test requires adjacent tile for trap_place_snare validation');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires far tile for trap_place_snare range rejection');

  player.x = playerTile.x;
  player.y = playerTile.y;

  const missingSnare = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_snare',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(missingSnare.ok, false, 'trap_place_snare should require snare item in inventory');
  assert.equal(missingSnare.code, 'insufficient_item_quantity', 'missing snare should return insufficient_item_quantity');

  player.inventory.stacks = [{ itemId: 'tool:simple_snare', quantity: 1 }];
  const valid = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_snare',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(valid.ok, true, 'trap_place_snare should validate on adjacent land tile when snare is carried');
  assert.equal(valid.normalizedAction.tickCost, 2, 'trap_place_snare should normalize to 2 tick cost');

  const farValidation = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_snare',
    payload: { x: farTile.x, y: farTile.y },
  });
  assert.equal(farValidation.ok, false, 'trap_place_snare should reject far target tile');
  assert.equal(farValidation.code, 'interaction_out_of_range', 'far trap_place_snare target should return interaction_out_of_range');

  adjacentTile.plantIds = ['occupied_plant'];
  const occupiedValidation = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_snare',
    payload: { x: adjacentTile.x, y: adjacentTile.y },
  });
  assert.equal(occupiedValidation.ok, false, 'trap_place_snare should reject tiles with existing plants');
  assert.equal(occupiedValidation.code, 'trap_place_snare_tile_occupied', 'plant-occupied snare tile should return trap_place_snare_tile_occupied');
}

function runTrapPlaceSnareRuntimeAndDailyResolutionTest() {
  const state = createInitialGameState(4273, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires land tile for trap_place_snare runtime');

  player.x = landTile.x;
  player.y = landTile.y;
  player.inventory.stacks = [{ itemId: 'tool:simple_snare', quantity: 1 }];

  const tileKey = `${landTile.x},${landTile.y}`;
  state.animalZonesGenerated = true;
  state.animalDensityByZone = {
    ...(state.animalDensityByZone || {}),
    sylvilagus_floridanus: {
      ...(state.animalDensityByZone?.sylvilagus_floridanus || {}),
      [tileKey]: 1,
    },
  };

  const placed = advanceTick(state, {
    actions: [
      {
        actionId: 'trap-place-snare',
        actorId: 'player',
        kind: 'trap_place_snare',
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const placeLog = placed.currentDayActionLog.find((entry) => entry.actionId === 'trap-place-snare');
  assert.ok(placeLog && placeLog.status === 'applied', 'trap_place_snare runtime action should be applied');
  assert.equal(placeLog.tickCost, 2, 'trap_place_snare should consume 2 ticks');
  assert.equal(placed.actors.player.tickBudgetCurrent, 198, 'trap_place_snare should consume 2 actor budget ticks');

  const placedTile = placed.tiles[landTile.y * placed.width + landTile.x];
  assert.ok(placedTile.simpleSnare && placedTile.simpleSnare.active === true, 'trap_place_snare should persist active tile simpleSnare state');
  assert.equal(
    placed.actors.player.inventory.stacks.some((entry) => entry.itemId === 'tool:simple_snare'),
    false,
    'trap_place_snare should consume one snare item from inventory',
  );

  const dayResolvedA = advanceDay(placed, 1);
  const dayResolvedB = advanceDay(placed, 1);
  const resolvedTileA = dayResolvedA.tiles[landTile.y * dayResolvedA.width + landTile.x];
  const resolvedTileB = dayResolvedB.tiles[landTile.y * dayResolvedB.width + landTile.x];

  assert.ok(resolvedTileA.simpleSnare, 'daily snare resolution should preserve simpleSnare state');
  assert.equal(
    resolvedTileA.simpleSnare.hasCatch,
    resolvedTileB.simpleSnare.hasCatch,
    'daily snare resolution should be deterministic for identical input state',
  );
  assert.equal(
    resolvedTileA.simpleSnare.lastRoll,
    resolvedTileB.simpleSnare.lastRoll,
    'daily snare resolution roll should be deterministic for identical input state',
  );
  assert.equal(
    resolvedTileA.simpleSnare.lastResolvedYear,
    placed.year,
    'daily snare resolution should record the resolution year before day increment',
  );
  assert.equal(
    resolvedTileA.simpleSnare.lastResolvedDay,
    placed.dayOfYear,
    'daily snare resolution should record the resolution day before day increment',
  );
  assert.ok(
    resolvedTileA.simpleSnare.reliability <= 1 && resolvedTileA.simpleSnare.reliability >= 0.35,
    'daily snare resolution should decay reliability into expected bounded range',
  );
}

function runTrapPlaceSnarePoachChanceScalingTest() {
  const dayScenarios = [
    { daysSinceCatch: 0, expectedChance: 0 },
    { daysSinceCatch: 1, expectedChance: 0.2 },
    { daysSinceCatch: 2, expectedChance: 0.5 },
    { daysSinceCatch: 3, expectedChance: 1 },
  ];

  for (const scenario of dayScenarios) {
    const state = createInitialGameState(4274 + scenario.daysSinceCatch, { width: 30, height: 30 });
    const tile = state.tiles.find((entry) => !entry.waterType && !entry.rockType);
    assert.ok(tile, 'test requires land tile for snare poach scaling checks');

    state.totalDaysSimulated = 10;
    tile.simpleSnare = {
      active: true,
      hasCatch: true,
      poached: false,
      sprung: true,
      reliability: 1,
      rabbitDensity: 0.8,
      placedYear: state.year,
      placedDay: state.dayOfYear,
      placedDayTick: 0,
      catchResolvedTotalDays: 10 - scenario.daysSinceCatch,
      daysSinceCatch: scenario.daysSinceCatch,
      lastResolvedYear: null,
      lastResolvedDay: null,
      lastRoll: null,
      lastPoachChance: null,
      lastPoachRoll: null,
    };

    const resolved = advanceDay(state, 1);
    const resolvedTile = resolved.tiles[tile.y * resolved.width + tile.x];
    assert.ok(resolvedTile.simpleSnare, 'resolved snare should retain simpleSnare state after poach roll');
    assert.ok(
      Math.abs(resolvedTile.simpleSnare.lastPoachChance - scenario.expectedChance) < 0.0001,
      `snare poach chance should match day schedule for day ${scenario.daysSinceCatch + 1}`,
    );
    assert.ok(
      (resolvedTile.simpleSnare.poached === true && resolvedTile.simpleSnare.hasCatch === false)
        || (resolvedTile.simpleSnare.poached === false && resolvedTile.simpleSnare.hasCatch === true),
      'poach roll should produce consistent sprung-empty vs caught state',
    );
  }
}

function runTrapCheckRetrievesCarcassAndResetsSnareTest() {
  const state = createInitialGameState(4275, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires land tile for trap_check retrieval');

  player.x = landTile.x;
  player.y = landTile.y;

  landTile.simpleSnare = {
    active: true,
    hasCatch: true,
    poached: false,
    sprung: true,
    reliability: 0.72,
    rabbitDensity: 0.9,
    placedYear: state.year,
    placedDay: state.dayOfYear,
    placedDayTick: 0,
    catchResolvedTotalDays: 5,
    daysSinceCatch: 2,
    lastResolvedYear: state.year,
    lastResolvedDay: state.dayOfYear,
    lastRoll: 0.11,
    lastPoachChance: 0.22,
    lastPoachRoll: 0.19,
  };

  const validated = validateAction(state, {
    actorId: 'player',
    kind: 'trap_check',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(validated.ok, true, 'trap_check should validate on active snare tile in range');
  assert.equal(validated.normalizedAction.tickCost, 2, 'trap_check should normalize to 2 tick cost');

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'trap-check-snare',
        actorId: 'player',
        kind: 'trap_check',
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const tileAfter = next.tiles[landTile.y * next.width + landTile.x];
  assert.ok(tileAfter.simpleSnare, 'trap_check should preserve snare object on tile');
  assert.equal(tileAfter.simpleSnare.hasCatch, false, 'trap_check should clear caught state after retrieval');
  assert.equal(tileAfter.simpleSnare.sprung, false, 'trap_check should reset sprung state after retrieval');
  assert.equal(tileAfter.simpleSnare.poached, false, 'trap_check should clear poached marker on reset');

  const carcassStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'sylvilagus_floridanus:carcass');
  assert.ok(carcassStack, 'trap_check should add rabbit carcass to inventory when catch exists');
  assert.equal(carcassStack.quantity, 1, 'trap_check should add exactly one carcass per catch');
}

function runTrapCheckRetrievesDeadfallCarcassAndResetsTrapTest() {
  const state = createInitialGameState(4283, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires land tile for deadfall trap_check retrieval');

  player.x = landTile.x;
  player.y = landTile.y;

  landTile.deadfallTrap = {
    active: true,
    hasCatch: true,
    poached: false,
    sprung: true,
    reliability: 0.88,
    lastDensity: 1,
    caughtSpeciesId: 'sciurus_carolinensis',
    placedYear: state.year,
    placedDay: state.dayOfYear,
    placedDayTick: 0,
    catchResolvedTotalDays: 5,
    daysSinceCatch: 2,
    lastResolvedYear: state.year,
    lastResolvedDay: state.dayOfYear,
    lastRoll: 0.14,
    lastPoachChance: 0.2,
    lastPoachRoll: 0.41,
  };

  const validated = validateAction(state, {
    actorId: 'player',
    kind: 'trap_check',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(validated.ok, true, 'trap_check should validate on active deadfall tile in range');

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'trap-check-deadfall',
        actorId: 'player',
        kind: 'trap_check',
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const tileAfter = next.tiles[landTile.y * next.width + landTile.x];
  assert.ok(tileAfter.deadfallTrap, 'trap_check should preserve deadfall object on tile');
  assert.equal(tileAfter.deadfallTrap.hasCatch, false, 'trap_check should clear deadfall caught state after retrieval');
  assert.equal(tileAfter.deadfallTrap.sprung, false, 'trap_check should reset deadfall sprung state after retrieval');
  assert.equal(tileAfter.deadfallTrap.caughtSpeciesId, null, 'trap_check should clear deadfall caught species after retrieval');

  const carcassStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'sciurus_carolinensis:carcass');
  assert.ok(carcassStack, 'trap_check should add deadfall carcass species to inventory when catch exists');
  assert.equal(carcassStack.quantity, 1, 'trap_check should add exactly one carcass per deadfall catch');
}

function runCarcassButcherRequiresKnifeAndYieldsSubpartsTest() {
  const state = createInitialGameState(4276, { width: 30, height: 30 });
  const player = state.actors.player;

  player.inventory.stacks = [{ itemId: 'sylvilagus_floridanus:carcass', quantity: 1 }];

  const missingKnife = validateAction(state, {
    actorId: 'player',
    kind: 'process_item',
    payload: {
      itemId: 'sylvilagus_floridanus:carcass',
      processId: 'butcher',
      quantity: 1,
    },
  });
  assert.equal(missingKnife.ok, false, 'carcass butcher should require knife in inventory');
  assert.equal(missingKnife.code, 'missing_required_tool', 'carcass butcher without knife should reject with missing_required_tool');
  assert.equal(missingKnife.requiredToolId, 'tool:flint_knife', 'carcass butcher should identify knife requirement');

  player.inventory.stacks.push({ itemId: 'tool:flint_knife', quantity: 1 });
  const withKnife = validateAction(state, {
    actorId: 'player',
    kind: 'process_item',
    payload: {
      itemId: 'sylvilagus_floridanus:carcass',
      processId: 'butcher',
      quantity: 1,
    },
  });
  assert.equal(withKnife.ok, true, 'carcass butcher should validate when knife is present');
  assert.equal(withKnife.normalizedAction.tickCost, 10, 'carcass butcher should normalize deterministic butcher tick cost');

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'butcher-rabbit-carcass',
        actorId: 'player',
        kind: 'process_item',
        payload: {
          itemId: 'sylvilagus_floridanus:carcass',
          processId: 'butcher',
          quantity: 1,
        },
      },
    ],
  });

  const stacks = next.actors.player.inventory.stacks;
  assert.equal(
    stacks.some((entry) => entry.itemId === 'sylvilagus_floridanus:carcass'),
    false,
    'carcass butcher should consume carcass input stack',
  );

  const rabbitMeat = stacks.find((entry) => entry.itemId === 'sylvilagus_floridanus:meat');
  const rabbitHide = stacks.find((entry) => entry.itemId === 'sylvilagus_floridanus:hide');
  const rabbitBone = stacks.find((entry) => entry.itemId === 'sylvilagus_floridanus:bone');
  const rabbitFat = stacks.find((entry) => entry.itemId === 'sylvilagus_floridanus:fat');

  assert.ok(rabbitMeat && rabbitMeat.quantity === 520, 'carcass butcher should output rabbit meat grams from catalog yield');
  assert.ok(rabbitHide && rabbitHide.quantity === 650, 'carcass butcher should output rabbit hide grams from catalog yield');
  assert.ok(rabbitBone && rabbitBone.quantity === 1, 'carcass butcher should output rabbit bone quantity from catalog yield');
  assert.ok(rabbitFat && rabbitFat.quantity === 60, 'carcass butcher should output rabbit fat grams from catalog yield');
}

function runFellTreeValidationRulesTest() {
  const state = createInitialGameState(4269, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for fell_tree validation');
  const adjacentTile = findAdjacentLandTile(state, playerTile);
  assert.ok(adjacentTile, 'test requires adjacent tile for fell_tree validation');
  const farTile = findFarLandTile(state, playerTile);
  assert.ok(farTile, 'test requires far tile for fell_tree range rejection');

  const speciesId = 'test_species_fell_tree_validation';
  const previousSpecies = PLANT_BY_ID[speciesId];
  PLANT_BY_ID[speciesId] = {
    id: speciesId,
    longevity: 'perennial',
    lifeStages: [
      { stage: 'sapling', size: 5, min_age_days: 0, seasonalWindow: null },
      { stage: 'mature', size: 8, min_age_days: 30, seasonalWindow: null },
    ],
    parts: [],
  };

  try {
    player.x = playerTile.x;
    player.y = playerTile.y;

    state.plants = {
      fell_target_adjacent: {
        id: 'fell_target_adjacent',
        speciesId,
        age: 40,
        x: adjacentTile.x,
        y: adjacentTile.y,
        stageName: 'mature',
        alive: true,
        vitality: 1,
        activeSubStages: [],
        source: 'test',
      },
      fell_target_far: {
        id: 'fell_target_far',
        speciesId,
        age: 40,
        x: farTile.x,
        y: farTile.y,
        stageName: 'mature',
        alive: true,
        vitality: 1,
        activeSubStages: [],
        source: 'test',
      },
      fell_target_small: {
        id: 'fell_target_small',
        speciesId,
        age: 10,
        x: adjacentTile.x,
        y: adjacentTile.y,
        stageName: 'seedling',
        alive: true,
        vitality: 1,
        activeSubStages: [],
        source: 'test',
      },
    };
    adjacentTile.plantIds = ['fell_target_adjacent'];
    farTile.plantIds = ['fell_target_far'];

    player.inventory.stacks = [];
    const missingAxe = validateAction(state, {
      actorId: 'player',
      kind: 'fell_tree',
      payload: { plantId: 'fell_target_adjacent' },
    });
    assert.equal(missingAxe.ok, false, 'fell_tree should require axe in inventory');
    assert.equal(missingAxe.code, 'missing_required_tool', 'missing axe should report missing_required_tool');

    player.inventory.stacks = [{ itemId: 'tool:axe', quantity: 1 }];
    const valid = validateAction(state, {
      actorId: 'player',
      kind: 'fell_tree',
      payload: { plantId: 'fell_target_adjacent' },
    });
    assert.equal(valid.ok, true, 'fell_tree should validate for adjacent mature perennial target with axe');
    assert.equal(valid.normalizedAction.tickCost, 80, 'fell_tree should normalize medium-large tree to 80 tick cost');
    assert.equal(valid.normalizedAction.payload.poleYield, 6, 'fell_tree should normalize medium-large tree to 6 poles');

    const farValidation = validateAction(state, {
      actorId: 'player',
      kind: 'fell_tree',
      payload: { plantId: 'fell_target_far' },
    });
    assert.equal(farValidation.ok, false, 'fell_tree should reject far target');
    assert.equal(farValidation.code, 'interaction_out_of_range', 'far fell_tree target should return interaction_out_of_range');

    const smallValidation = validateAction(state, {
      actorId: 'player',
      kind: 'fell_tree',
      payload: { plantId: 'fell_target_small' },
    });
    assert.equal(smallValidation.ok, false, 'fell_tree should reject below-sapling targets');
    assert.equal(smallValidation.code, 'fell_tree_invalid_target', 'small fell_tree target should return fell_tree_invalid_target');
  } finally {
    if (previousSpecies) {
      PLANT_BY_ID[speciesId] = previousSpecies;
    } else {
      delete PLANT_BY_ID[speciesId];
    }
  }
}

function runFellTreeRuntimeAndPoleYieldTest() {
  const state = createInitialGameState(4270, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires land tile for fell_tree runtime');

  const speciesId = 'test_species_fell_tree_runtime';
  const previousSpecies = PLANT_BY_ID[speciesId];
  PLANT_BY_ID[speciesId] = {
    id: speciesId,
    longevity: 'perennial',
    lifeStages: [
      { stage: 'mature', size: 9, min_age_days: 0, seasonalWindow: null },
    ],
    parts: [],
  };

  try {
    state.plants = {
      fell_runtime_target: {
        id: 'fell_runtime_target',
        speciesId,
        age: 120,
        x: landTile.x,
        y: landTile.y,
        stageName: 'mature',
        alive: true,
        vitality: 1,
        activeSubStages: [],
        source: 'test',
      },
    };
    landTile.plantIds = ['fell_runtime_target'];

    player.x = landTile.x;
    player.y = landTile.y;
    player.inventory.stacks = [{ itemId: 'tool:axe', quantity: 1 }];

    const next = advanceTick(state, {
      actions: [
        {
          actionId: 'fell-tree-runtime',
          actorId: 'player',
          kind: 'fell_tree',
          payload: { plantId: 'fell_runtime_target' },
        },
      ],
    });

    const logEntry = next.currentDayActionLog.find((entry) => entry.actionId === 'fell-tree-runtime');
    assert.ok(logEntry && logEntry.status === 'applied', 'fell_tree runtime action should be applied');
    assert.equal(logEntry.tickCost, 130, 'fell_tree very-large target should consume 130 ticks');

    const poleStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'pole');
    assert.ok(poleStack, 'fell_tree should add poles to inventory');
    assert.equal(poleStack.quantity, 10, 'fell_tree very-large target should produce 10 poles');

    const postTile = next.tiles[landTile.y * next.width + landTile.x];
    assert.equal(postTile.disturbed, true, 'fell_tree should mark target tile disturbed');
    assert.equal(postTile.plantIds.includes('fell_runtime_target'), false, 'fell_tree should remove plant occupancy from target tile');
    assert.ok(postTile.deadLog, 'fell_tree on tree-size perennial should create dead log data');
    assert.equal(postTile.deadLog.sourceSpeciesId, speciesId, 'fell_tree dead log should preserve source species id');

    assert.equal(next.plants.fell_runtime_target, undefined, 'fell_tree should remove target from plants collection');
    assert.equal(next.actors.player.tickBudgetCurrent, 70, 'fell_tree should consume full normalized tick cost from budget');
  } finally {
    if (previousSpecies) {
      PLANT_BY_ID[speciesId] = previousSpecies;
    } else {
      delete PLANT_BY_ID[speciesId];
    }
  }
}

function runSapTapSnapshotRoundTripTest() {
  const state = createInitialGameState(4245, { width: 30, height: 30 });
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile for sapTap snapshot round-trip');

  landTile.sapTap = {
    hasSpout: true,
    insertedDay: 7,
    insertedDayTick: 29,
    hasVessel: true,
    vesselPlacedDay: 8,
    vesselPlacedDayTick: 4,
    vesselSapUnits: 6,
    vesselCapacityUnits: 10,
  };

  const encoded = serializeGameState(state);
  const decoded = deserializeGameState(encoded);
  const decodedTile = decoded.tiles[landTile.y * decoded.width + landTile.x];
  assert.deepEqual(
    decodedTile.sapTap,
    {
      hasSpout: true,
      insertedDay: 7,
      insertedDayTick: 29,
      hasVessel: true,
      vesselPlacedDay: 8,
      vesselPlacedDayTick: 4,
      vesselSapUnits: 6,
      vesselCapacityUnits: 10,
    },
    'sapTap tile state should survive snapshot serialize/deserialize round-trip',
  );
}

function runAutoRodSnapshotRoundTripTest() {
  const state = createInitialGameState(5331, { width: 30, height: 30 });
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile for autoRod snapshot round-trip');

  landTile.autoRod = {
    active: true,
    state: 'broken',
    baitItemId: null,
    pendingSpeciesIds: ['esox_lucius'],
    placedYear: 1,
    placedDay: 7,
    placedDayTick: 9,
    lastResolvedYear: 1,
    lastResolvedDay: 8,
    lastResolvedDayTick: 12,
    lastSpeciesId: 'esox_lucius',
    lastCatchSuccess: true,
    lastLineSnapped: true,
    lastBiteChance: 0.75,
    lastBiteRoll: 0.2,
    lastHookRate: 0.8,
    lastHookRoll: 0.3,
    lastSnapProbability: 0.95,
    lastSnapRoll: 0.2,
  };

  const encoded = serializeGameState(state);
  const decoded = deserializeGameState(encoded);
  const decodedTile = decoded.tiles[landTile.y * decoded.width + landTile.x];
  assert.deepEqual(
    decodedTile.autoRod,
    {
      active: true,
      state: 'broken',
      baitItemId: null,
      pendingSpeciesIds: ['esox_lucius'],
      placedYear: 1,
      placedDay: 7,
      placedDayTick: 9,
      lastResolvedYear: 1,
      lastResolvedDay: 8,
      lastResolvedDayTick: 12,
      lastSpeciesId: 'esox_lucius',
      lastCatchSuccess: true,
      lastLineSnapped: true,
      lastBiteChance: 0.75,
      lastBiteRoll: 0.2,
      lastHookRate: 0.8,
      lastHookRoll: 0.3,
      lastSnapProbability: 0.95,
      lastSnapRoll: 0.2,
    },
    'autoRod tile state should survive snapshot serialize/deserialize round-trip',
  );
}

function runThreadSpinnerPartnerTaskTickReductionTest() {
  const state = createInitialGameState(4232, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_station_thread_spinner: true,
  };

  const beforeBuild = validateAction(state, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        kind: 'spin_cordage',
        ticksRequired: 10,
      },
    },
  });
  assert.equal(beforeBuild.ok, true, 'partner_task_set spin_cordage should validate before thread spinner build');
  assert.equal(
    beforeBuild.normalizedAction.payload.task.ticksRequired,
    10,
    'without thread spinner station built, partner spin_cordage ticksRequired should stay at base',
  );

  const afterBuild = advanceTick(state, {
    actions: [
      {
        actionId: 'build-thread-spinner',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'thread_spinner' },
      },
    ],
  });
  assert.ok(
    afterBuild.camp.stationsUnlocked.includes('thread_spinner'),
    'thread spinner should be unlocked after build action',
  );

  const postBuildForValidation = {
    ...afterBuild,
    actors: {
      ...afterBuild.actors,
      player: {
        ...afterBuild.actors.player,
        tickBudgetCurrent: 200,
      },
    },
  };

  const reducedCordageTask = validateAction(postBuildForValidation, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        kind: 'spin_cordage',
        ticksRequired: 10,
      },
    },
  });
  assert.equal(reducedCordageTask.ok, true, 'partner_task_set spin_cordage should validate after thread spinner build');
  assert.equal(
    reducedCordageTask.normalizedAction.payload.task.ticksRequired,
    5,
    'thread spinner should halve partner spin_cordage ticksRequired',
  );

  const unaffectedTask = validateAction(postBuildForValidation, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        kind: 'craft_basket',
        ticksRequired: 10,
      },
    },
  });
  assert.equal(unaffectedTask.ok, true, 'non-cordage partner task should still validate after thread spinner build');
  assert.equal(
    unaffectedTask.normalizedAction.payload.task.ticksRequired,
    10,
    'thread spinner should not modify non-cordage partner task ticksRequired',
  );

  const spinTaskRun = advanceTick(postBuildForValidation, {
    actions: [
      {
        actionId: 'set-spin-cordage-task',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          task: {
            taskId: 'spin-cordage-job',
            kind: 'spin_cordage',
            ticksRequired: 10,
            outputs: [{ itemId: 'cordage', quantity: 2 }],
          },
        },
      },
    ],
    idleTicks: 4,
  });

  const cordageStack = spinTaskRun.camp.stockpile.stacks.find((entry) => entry.itemId === 'cordage');
  assert.ok(cordageStack, 'completed spin_cordage task should deposit cordage into camp stockpile');
  assert.equal(cordageStack.quantity, 2, 'spin_cordage output should add configured cordage unit quantity');
}

function runIntermediateItemRegistryConsistencyTest() {
  assert.ok(ITEM_BY_ID.cordage, 'item registry should define canonical cordage item');
  assert.ok(ITEM_BY_ID.hide, 'item registry should define canonical hide item');
  assert.ok(ITEM_BY_ID.dried_hide, 'item registry should define canonical dried_hide item');
  assert.ok(ITEM_BY_ID.fat, 'item registry should define canonical fat item');
  assert.ok(ITEM_BY_ID['tool:stool'], 'item registry should define canonical tool:stool item');
  assert.ok(ITEM_BY_ID['tool:bone_hook'], 'item registry should define canonical tool:bone_hook item');
  assert.ok(ITEM_BY_ID['tool:sun_hat'], 'item registry should define canonical tool:sun_hat item');
  assert.ok(ITEM_BY_ID['tool:leaching_basket'], 'item registry should define canonical tool:leaching_basket item');

  const rabbit = ANIMAL_BY_ID.sylvilagus_floridanus;
  assert.ok(rabbit, 'test precondition: expected rabbit species in animal catalog');
  const rabbitHide = (rabbit.parts || []).find((entry) => entry.id === 'hide');
  const rabbitFat = (rabbit.parts || []).find((entry) => entry.id === 'fat');
  assert.ok(rabbitHide, 'rabbit should include hide part');
  assert.ok(rabbitFat, 'rabbit should include fat part');

  assert.equal(rabbitHide.unit_weight_g, ITEM_BY_ID.hide.unit_weight_g, 'animal hide part should use canonical item registry unit weight');
  assert.equal(rabbitHide.can_dry, ITEM_BY_ID.hide.can_dry, 'animal hide part should use canonical item registry drying flag');
  assert.equal(rabbitHide.can_freeze, ITEM_BY_ID.hide.can_freeze, 'animal hide part should use canonical item registry freezing flag');

  assert.deepEqual(
    rabbitFat.nutrition,
    ITEM_BY_ID.fat.nutrition,
    'animal fat nutrition should be sourced from canonical item registry definition',
  );

  const scrapeOutput = rabbitHide.processing_options?.[0]?.outputs?.[0] || null;
  assert.equal(scrapeOutput?.itemId, 'dried_hide', 'hide processing output should reference canonical dried_hide itemId');

  assert.throws(
    () => assertKnownItemId('not_a_real_item', 'test processing output'),
    /Unknown test processing output/,
    'unknown canonical item references should fail hard',
  );
}

function runHideFramePartnerTaskStationRequirementTest() {
  const state = createInitialGameState(4233, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_station_hide_frame: true,
  };

  const beforeBuild = validateAction(state, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        kind: 'scrape_and_dry',
        ticksRequired: 8,
        outputs: [{ itemId: 'dried_hide', quantity: 1 }],
      },
    },
  });
  assert.equal(beforeBuild.ok, false, 'scrape_and_dry should require hide_frame station to be built');
  assert.equal(beforeBuild.code, 'missing_station', 'scrape_and_dry without hide_frame should reject with missing_station');
  assert.equal(beforeBuild.stationId, 'hide_frame', 'missing_station response should identify hide_frame requirement');

  const afterBuild = advanceTick(state, {
    actions: [
      {
        actionId: 'build-hide-frame',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'hide_frame' },
      },
    ],
  });
  assert.ok(afterBuild.camp.stationsUnlocked.includes('hide_frame'), 'hide_frame should be unlocked after build action');

  const postBuildForValidation = {
    ...afterBuild,
    actors: {
      ...afterBuild.actors,
      player: {
        ...afterBuild.actors.player,
        tickBudgetCurrent: 200,
      },
    },
  };

  const afterBuildValidation = validateAction(postBuildForValidation, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        kind: 'scrape_and_dry',
        ticksRequired: 8,
        outputs: [{ itemId: 'dried_hide', quantity: 1 }],
      },
    },
  });
  assert.equal(afterBuildValidation.ok, true, 'scrape_and_dry should validate once hide_frame is built');

  const taskRun = advanceTick(postBuildForValidation, {
    actions: [
      {
        actionId: 'queue-hide-task',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          task: {
            taskId: 'hide-job',
            kind: 'scrape_and_dry',
            ticksRequired: 8,
            outputs: [{ itemId: 'dried_hide', quantity: 1 }],
          },
        },
      },
    ],
    idleTicks: 7,
  });
  const hideStack = taskRun.camp.stockpile.stacks.find((entry) => entry.itemId === 'dried_hide');
  assert.ok(hideStack, 'completed scrape_and_dry task should deposit dried_hide into camp stockpile');
  assert.equal(hideStack.quantity, 1, 'scrape_and_dry output should add configured dried_hide quantity');
}

function runMortarPestlePartnerTaskStationRequirementTest() {
  const state = createInitialGameState(4234, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_station_mortar_pestle: true,
  };

  const beforeBuild = validateAction(state, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        kind: 'crack_shell',
        ticksRequired: 8,
        outputs: [{ itemId: 'walnut_meat', quantity: 1 }],
      },
    },
  });
  assert.equal(beforeBuild.ok, false, 'crack_shell should require mortar_pestle station to be built');
  assert.equal(beforeBuild.code, 'missing_station', 'crack_shell without mortar_pestle should reject with missing_station');
  assert.equal(beforeBuild.stationId, 'mortar_pestle', 'missing_station response should identify mortar_pestle requirement');

  const afterBuild = advanceTick(state, {
    actions: [
      {
        actionId: 'build-mortar-pestle',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'mortar_pestle' },
      },
    ],
  });
  assert.ok(afterBuild.camp.stationsUnlocked.includes('mortar_pestle'), 'mortar_pestle should be unlocked after build action');

  const postBuildForValidation = {
    ...afterBuild,
    actors: {
      ...afterBuild.actors,
      player: {
        ...afterBuild.actors.player,
        tickBudgetCurrent: 200,
      },
    },
  };

  const afterBuildValidation = validateAction(postBuildForValidation, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        kind: 'crack_shell',
        ticksRequired: 8,
        outputs: [{ itemId: 'walnut_meat', quantity: 1 }],
      },
    },
  });
  assert.equal(afterBuildValidation.ok, true, 'crack_shell should validate once mortar_pestle is built');

  const taskRun = advanceTick(postBuildForValidation, {
    actions: [
      {
        actionId: 'queue-crack-shell-task',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          task: {
            taskId: 'mortar-job',
            kind: 'crack_shell',
            ticksRequired: 8,
            outputs: [{ itemId: 'walnut_meat', quantity: 1 }],
          },
        },
      },
    ],
    idleTicks: 7,
  });
  const outputStack = taskRun.camp.stockpile.stacks.find((entry) => entry.itemId === 'walnut_meat');
  assert.ok(outputStack, 'completed crack_shell task should deposit walnut_meat into camp stockpile');
  assert.equal(outputStack.quantity, 1, 'crack_shell output should add configured walnut_meat quantity');
}

function runSugarBoilingPartnerTaskStationRequirementTest() {
  const state = createInitialGameState(4235, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_station_sugar_boiling_station: true,
  };

  const beforeBuild = validateAction(state, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        kind: 'boil_sap',
        ticksRequired: 8,
        outputs: [{ itemId: 'maple_sugar', quantity: 1 }],
      },
    },
  });
  assert.equal(beforeBuild.ok, false, 'boil_sap should require sugar_boiling_station to be built');
  assert.equal(beforeBuild.code, 'missing_station', 'boil_sap without sugar_boiling_station should reject with missing_station');
  assert.equal(
    beforeBuild.stationId,
    'sugar_boiling_station',
    'missing_station response should identify sugar_boiling_station requirement',
  );

  const afterBuild = advanceTick(state, {
    actions: [
      {
        actionId: 'build-sugar-boiling-station',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'sugar_boiling_station' },
      },
    ],
  });
  assert.ok(
    afterBuild.camp.stationsUnlocked.includes('sugar_boiling_station'),
    'sugar_boiling_station should be unlocked after build action',
  );

  const postBuildForValidation = {
    ...afterBuild,
    actors: {
      ...afterBuild.actors,
      player: {
        ...afterBuild.actors.player,
        tickBudgetCurrent: 200,
      },
    },
  };

  const afterBuildValidation = validateAction(postBuildForValidation, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        kind: 'boil_sap',
        ticksRequired: 8,
        outputs: [{ itemId: 'maple_sugar', quantity: 1 }],
      },
    },
  });
  assert.equal(afterBuildValidation.ok, true, 'boil_sap should validate once sugar_boiling_station is built');

  const taskRun = advanceTick(postBuildForValidation, {
    actions: [
      {
        actionId: 'queue-boil-sap-task',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          task: {
            taskId: 'sugar-job',
            kind: 'boil_sap',
            ticksRequired: 8,
            outputs: [{ itemId: 'maple_sugar', quantity: 1 }],
          },
        },
      },
    ],
    idleTicks: 7,
  });
  const outputStack = taskRun.camp.stockpile.stacks.find((entry) => entry.itemId === 'maple_sugar');
  assert.ok(outputStack, 'completed boil_sap task should deposit maple_sugar into camp stockpile');
  assert.equal(outputStack.quantity, 1, 'boil_sap output should add configured maple_sugar quantity');
}

function runProcessItemHandCatalogPipelineTest() {
  const state = createInitialGameState(4236, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.actors.player.inventory.stacks = [
    {
      itemId: 'juglans_nigra:whole_fruit:green',
      quantity: 4,
      footprintW: 1,
      footprintH: 1,
      slotX: 0,
      slotY: 0,
    },
  ];

  const preview = validateAction(state, {
    actorId: 'player',
    kind: 'process_item',
    payload: {
      itemId: 'juglans_nigra:whole_fruit:green',
      processId: 'remove_husk',
      quantity: 4,
    },
  });

  assert.equal(preview.ok, true, 'process_item should validate for hand processing option from catalog');
  assert.equal(preview.normalizedAction.tickCost, 20, 'process_item tickCost should use catalog processing ticks');
  assert.equal(preview.normalizedAction.payload.processLocation, 'hand', 'process_item should normalize catalog location');

  const outputs = preview.normalizedAction.payload.outputs;
  assert.ok(
    outputs.some((entry) => entry.itemId === 'juglans_nigra:husked_nut:whole' && entry.quantity === 1),
    'remove_husk should produce expected husked_nut output from catalog fractions',
  );
  assert.ok(
    outputs.some((entry) => entry.itemId === 'juglans_nigra:husk:raw' && entry.quantity === 3),
    'remove_husk should produce expected husk output from catalog fractions',
  );

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'process-green-walnut',
        actorId: 'player',
        kind: 'process_item',
        payload: {
          itemId: 'juglans_nigra:whole_fruit:green',
          processId: 'remove_husk',
          quantity: 4,
        },
      },
    ],
  });

  const sourceAfter = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'juglans_nigra:whole_fruit:green');
  assert.equal(sourceAfter, undefined, 'process_item should consume source stack quantity');
  const huskedNut = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'juglans_nigra:husked_nut:whole');
  const husk = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'juglans_nigra:husk:raw');
  assert.ok(huskedNut, 'process_item should add husked nut output to inventory');
  assert.ok(husk, 'process_item should add husk output to inventory');
  assert.equal(huskedNut.quantity, 1, 'process_item should add expected husked nut quantity');
  assert.equal(husk.quantity, 3, 'process_item should add expected husk quantity');
}

function runProcessItemStationRequirementPipelineTest() {
  const state = createInitialGameState(4237, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_station_mortar_pestle: true,
  };
  state.actors.player.inventory.stacks = [
    {
      itemId: 'juglans_nigra:husked_nut:whole',
      quantity: 5,
      footprintW: 1,
      footprintH: 1,
      slotX: 0,
      slotY: 0,
    },
  ];

  const missingStation = validateAction(state, {
    actorId: 'player',
    kind: 'process_item',
    payload: {
      itemId: 'juglans_nigra:husked_nut:whole',
      processId: 'crack_shell',
      quantity: 5,
    },
  });
  assert.equal(missingStation.ok, false, 'station processing should fail validation before required station is built');
  assert.equal(missingStation.code, 'missing_station', 'station processing should use missing_station code when station absent');
  assert.equal(missingStation.stationId, 'mortar_pestle', 'station processing should identify required station');

  const afterBuild = advanceTick(state, {
    actions: [
      {
        actionId: 'build-mortar-for-processing',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'mortar_pestle' },
      },
    ],
  });

  const postBuild = {
    ...afterBuild,
    actors: {
      ...afterBuild.actors,
      player: {
        ...afterBuild.actors.player,
        tickBudgetCurrent: 200,
      },
    },
  };

  const valid = validateAction(postBuild, {
    actorId: 'player',
    kind: 'process_item',
    payload: {
      itemId: 'juglans_nigra:husked_nut:whole',
      processId: 'crack_shell',
      quantity: 5,
    },
  });
  assert.equal(valid.ok, true, 'station processing should validate after required station is built');
  assert.equal(
    valid.normalizedAction.tickCost,
    50,
    'process_item tickCost should be catalog ticks per unit × quantity (crack_shell: 10 × 5)',
  );

  const next = advanceTick(postBuild, {
    actions: [
      {
        actionId: 'crack-walnut-shells',
        actorId: 'player',
        kind: 'process_item',
        payload: {
          itemId: 'juglans_nigra:husked_nut:whole',
          processId: 'crack_shell',
          quantity: 5,
        },
      },
    ],
  });

  const sourceAfter = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'juglans_nigra:husked_nut:whole');
  assert.equal(sourceAfter, undefined, 'station process_item should consume source stack quantity');
  const walnutMeat = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'juglans_nigra:walnut_meat:raw');
  const nutshell = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'juglans_nigra:nutshell:broken');
  assert.ok(walnutMeat, 'station process_item should add walnut meat output');
  assert.ok(nutshell, 'station process_item should add nutshell output');
  assert.equal(walnutMeat.quantity, 1, 'station process_item should apply expected walnut meat fraction output');
  assert.equal(nutshell.quantity, 4, 'station process_item should apply expected nutshell fraction output');
}

function runProcessItemBoilSapFilledVesselPipelineTest() {
  const state = createInitialGameState(4238, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_station_sugar_boiling_station: true,
  };
  state.actors.player.inventory.stacks = [
    {
      itemId: 'tool:hide_pitch_vessel_filled_sap',
      quantity: 2,
      footprintW: 1,
      footprintH: 1,
      slotX: 0,
      slotY: 0,
    },
    {
      itemId: 'tool:hide_pitch_vessel',
      quantity: 1,
      footprintW: 1,
      footprintH: 1,
      slotX: 1,
      slotY: 0,
    },
  ];

  const missingStation = validateAction(state, {
    actorId: 'player',
    kind: 'process_item',
    payload: {
      itemId: 'tool:hide_pitch_vessel_filled_sap',
      processId: 'boil_sap',
      quantity: 2,
    },
  });
  assert.equal(missingStation.ok, false, 'boil_sap process_item should fail before sugar_boiling_station is built');
  assert.equal(missingStation.code, 'missing_station', 'boil_sap process_item should require sugar_boiling_station');
  assert.equal(missingStation.stationId, 'sugar_boiling_station', 'boil_sap process_item should identify sugar_boiling_station requirement');

  const afterBuild = advanceTick(state, {
    actions: [
      {
        actionId: 'build-sugar-boiling-station-for-process-item',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'sugar_boiling_station' },
      },
    ],
  });

  const postBuild = {
    ...afterBuild,
    actors: {
      ...afterBuild.actors,
      player: {
        ...afterBuild.actors.player,
        tickBudgetCurrent: 200,
      },
    },
  };

  const preview = validateAction(postBuild, {
    actorId: 'player',
    kind: 'process_item',
    payload: {
      itemId: 'tool:hide_pitch_vessel_filled_sap',
      processId: 'boil_sap',
      quantity: 2,
    },
  });
  assert.equal(preview.ok, true, 'boil_sap process_item should validate with filled vessel once station is built');
  assert.equal(preview.normalizedAction.tickCost, 150, 'boil_sap process_item should use shared contract tick cost');
  assert.equal(preview.normalizedAction.payload.processLocation, 'sugar_boiling_station', 'boil_sap process_item should require sugar_boiling_station location');
  assert.ok(
    preview.normalizedAction.payload.outputs.some((entry) => entry.itemId === 'tree_sugar' && entry.quantity === 2),
    'boil_sap process_item should output tree_sugar from filled vessels',
  );
  assert.ok(
    preview.normalizedAction.payload.returnItems.some((entry) => entry.itemId === 'tool:hide_pitch_vessel' && entry.quantity === 2),
    'boil_sap process_item should return empty vessels after boiling',
  );

  const emptyVesselPreview = validateAction(postBuild, {
    actorId: 'player',
    kind: 'process_item',
    payload: {
      itemId: 'tool:hide_pitch_vessel',
      processId: 'boil_sap',
      quantity: 1,
    },
  });
  assert.equal(emptyVesselPreview.ok, false, 'boil_sap process_item should reject empty vessel inputs');
  assert.equal(emptyVesselPreview.code, 'unknown_process_option', 'boil_sap process_item should only accept filled vessel inputs');

  const next = advanceTick(postBuild, {
    actions: [
      {
        actionId: 'boil-filled-vessels',
        actorId: 'player',
        kind: 'process_item',
        payload: {
          itemId: 'tool:hide_pitch_vessel_filled_sap',
          processId: 'boil_sap',
          quantity: 2,
        },
      },
    ],
  });

  const filledAfter = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:hide_pitch_vessel_filled_sap');
  assert.equal(filledAfter, undefined, 'boil_sap process_item should consume filled sap vessels');

  const treeSugar = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tree_sugar');
  assert.ok(treeSugar, 'boil_sap process_item should add tree_sugar output');
  assert.equal(treeSugar.quantity, 2, 'boil_sap process_item should add expected tree_sugar quantity');

  const emptyVessel = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:hide_pitch_vessel');
  assert.ok(emptyVessel, 'boil_sap process_item should return empty vessels to inventory');
  assert.equal(emptyVessel.quantity, 3, 'boil_sap process_item should preserve existing empties and add returned vessels');
}

function runProcessItemBoilSapNotPartnerRestrictedTest() {
  const state = createInitialGameState(4251, { width: 20, height: 20 });
  const player = state.actors.player;
  const partner = state.actors.partner;
  partner.health = 0;
  state.camp.stationsUnlocked = ['sugar_boiling_station'];
  seedSugarBoilingStationPlacement(state);

  player.inventory.stacks = [
    {
      itemId: 'tool:hide_pitch_vessel_filled_sap',
      quantity: 1,
      footprintW: 1,
      footprintH: 1,
      slotX: 0,
      slotY: 0,
    },
  ];

  const preview = validateAction(state, {
    actorId: 'player',
    kind: 'process_item',
    payload: {
      itemId: 'tool:hide_pitch_vessel_filled_sap',
      processId: 'boil_sap',
      quantity: 1,
    },
  });
  assert.equal(preview.ok, true, 'player process_item boil_sap should remain valid even if partner is unavailable');

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'player-boil-while-partner-down',
        actorId: 'player',
        kind: 'process_item',
        payload: {
          itemId: 'tool:hide_pitch_vessel_filled_sap',
          processId: 'boil_sap',
          quantity: 1,
        },
      },
    ],
  });

  const treeSugar = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tree_sugar');
  assert.ok(treeSugar, 'player should receive boil_sap output via process_item regardless of partner availability');
  assert.equal(treeSugar.quantity, 1, 'player process_item boil_sap should produce configured output quantity');
}

function runInterruptedPlayerProcessItemResumeTest() {
  const state = createInitialGameState(4252, { width: 20, height: 20 });
  state.camp.stationsUnlocked = ['sugar_boiling_station'];
  seedSugarBoilingStationPlacement(state);
  state.actors.player.inventory.stacks = [
    {
      itemId: 'tool:hide_pitch_vessel_filled_sap',
      quantity: 1,
      footprintW: 1,
      footprintH: 1,
      slotX: 0,
      slotY: 0,
    },
  ];

  const preview = validateAction(state, {
    actorId: 'player',
    kind: 'process_item',
    payload: {
      itemId: 'tool:hide_pitch_vessel_filled_sap',
      processId: 'boil_sap',
      quantity: 1,
    },
  });
  assert.equal(preview.ok, true, 'boil_sap process_item should validate for interruption resume test');
  const actionId = preview.normalizedAction.actionId;

  const withInterruptedProgress = {
    ...state,
    actors: {
      ...state.actors,
      player: {
        ...state.actors.player,
        health: 0,
      },
    },
    pendingActionQueue: [
      {
        __inProgressAction: true,
        actionId,
        actorId: 'player',
        kind: 'process_item',
        issuedAtTick: state.dayTick,
        normalizedAction: preview.normalizedAction,
        remainingTicks: 5,
        totalTicks: preview.normalizedAction.tickCost,
        budgetConsumed: true,
      },
    ],
  };

  const interrupted = advanceTick(withInterruptedProgress);
  const interruptedLog = interrupted.currentDayActionLog.find((entry) => entry.actionId === actionId);
  assert.ok(interruptedLog, 'interrupted in-progress process_item should be logged');
  assert.equal(interruptedLog.status, 'interrupted', 'unavailable actor should interrupt in-progress process_item');
  assert.equal(interrupted.pendingActionQueue.length, 1, 'interrupted process_item should remain queued for resume');
  assert.equal(interrupted.pendingActionQueue[0].remainingTicks, 5, 'interrupted process_item should preserve remaining ticks');
  assert.equal(
    interrupted.actors.player.inventory.stacks.some((entry) => entry.itemId === 'tree_sugar'),
    false,
    'interrupted process_item should not apply outputs before completion',
  );

  const resumedInput = {
    ...interrupted,
    actors: {
      ...interrupted.actors,
      player: {
        ...interrupted.actors.player,
        health: 1,
      },
    },
  };
  const resumed = advanceTick(resumedInput);

  const resumedLog = resumed.currentDayActionLog.find((entry) => entry.actionId === actionId && entry.status === 'applied');
  assert.ok(resumedLog, 'resumed in-progress process_item should complete and be logged as applied');
  assert.equal(resumed.pendingActionQueue.length, 0, 'completed resumed process_item should clear pending queue entry');

  const treeSugar = resumed.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tree_sugar');
  assert.ok(treeSugar, 'resumed process_item should apply outputs on completion');
  assert.equal(treeSugar.quantity, 1, 'resumed process_item should apply configured output quantity');
}

function runInterruptedPlayerToolCraftResumeTest() {
  const state = createInitialGameState(4253, { width: 20, height: 20 });
  state.actors.player.inventory.stacks = [
    { itemId: 'flint_cobble', quantity: 1 },
    { itemId: 'cordage', quantity: 1 },
  ];
  const preview = validateAction(state, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: {
      recipeId: 'flint_knife',
    },
  });
  assert.equal(preview.ok, true, 'flint_knife tool_craft should validate for interruption resume test');
  const actionId = preview.normalizedAction.actionId;

  const withInterruptedProgress = {
    ...state,
    actors: {
      ...state.actors,
      player: {
        ...state.actors.player,
        health: 0,
      },
    },
    pendingActionQueue: [
      {
        __inProgressAction: true,
        actionId,
        actorId: 'player',
        kind: 'tool_craft',
        issuedAtTick: state.dayTick,
        normalizedAction: preview.normalizedAction,
        remainingTicks: 6,
        totalTicks: preview.normalizedAction.tickCost,
        budgetConsumed: true,
      },
    ],
  };

  const interrupted = advanceTick(withInterruptedProgress);
  const interruptedLog = interrupted.currentDayActionLog.find((entry) => entry.actionId === actionId);
  assert.ok(interruptedLog, 'interrupted in-progress tool_craft should be logged');
  assert.equal(interruptedLog.status, 'interrupted', 'unavailable actor should interrupt in-progress tool_craft');
  assert.equal(interrupted.pendingActionQueue.length, 1, 'interrupted tool_craft should remain queued for resume');
  assert.equal(
    interrupted.actors.player.inventory.stacks.some((entry) => entry.itemId === 'tool:flint_knife'),
    false,
    'interrupted tool_craft should not produce output before completion',
  );

  const resumedInput = {
    ...interrupted,
    actors: {
      ...interrupted.actors,
      player: {
        ...interrupted.actors.player,
        health: 1,
      },
    },
  };
  const resumed = advanceTick(resumedInput);

  const resumedLog = resumed.currentDayActionLog.find((entry) => entry.actionId === actionId && entry.status === 'applied');
  assert.ok(resumedLog, 'resumed in-progress tool_craft should complete and be logged as applied');
  assert.equal(resumed.pendingActionQueue.length, 0, 'completed resumed tool_craft should clear pending queue entry');

  const craftedTool = resumed.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:flint_knife');
  assert.ok(craftedTool, 'resumed tool_craft should apply output on completion');
  assert.equal(craftedTool.quantity, 1, 'resumed tool_craft should apply configured output quantity');
}

function runInterruptedPlayerCampStationBuildResumeTest() {
  const state = createInitialGameState(4254, { width: 20, height: 20 });
  const preview = validateAction(state, {
    actorId: 'player',
    kind: 'camp_station_build',
    payload: {
      stationId: 'raised_sleeping_platform',
    },
  });
  assert.equal(preview.ok, true, 'raised_sleeping_platform build should validate for interruption resume test');
  const actionId = preview.normalizedAction.actionId;

  const withInterruptedProgress = {
    ...state,
    actors: {
      ...state.actors,
      player: {
        ...state.actors.player,
        health: 0,
      },
    },
    pendingActionQueue: [
      {
        __inProgressAction: true,
        actionId,
        actorId: 'player',
        kind: 'camp_station_build',
        issuedAtTick: state.dayTick,
        normalizedAction: preview.normalizedAction,
        remainingTicks: 9,
        totalTicks: preview.normalizedAction.tickCost,
        budgetConsumed: true,
      },
    ],
  };

  const interrupted = advanceTick(withInterruptedProgress);
  const interruptedLog = interrupted.currentDayActionLog.find((entry) => entry.actionId === actionId);
  assert.ok(interruptedLog, 'interrupted in-progress camp_station_build should be logged');
  assert.equal(interruptedLog.status, 'interrupted', 'unavailable actor should interrupt in-progress camp_station_build');
  assert.equal(interrupted.pendingActionQueue.length, 1, 'interrupted camp_station_build should remain queued for resume');
  assert.equal(
    interrupted.camp.stationsUnlocked.includes('raised_sleeping_platform'),
    false,
    'interrupted camp_station_build should not unlock station before completion',
  );

  const resumedInput = {
    ...interrupted,
    actors: {
      ...interrupted.actors,
      player: {
        ...interrupted.actors.player,
        health: 1,
      },
    },
  };
  const resumed = advanceTick(resumedInput);

  const resumedLog = resumed.currentDayActionLog.find((entry) => entry.actionId === actionId && entry.status === 'applied');
  assert.ok(resumedLog, 'resumed in-progress camp_station_build should complete and be logged as applied');
  assert.equal(resumed.pendingActionQueue.length, 0, 'completed resumed camp_station_build should clear pending queue entry');
  assert.ok(
    resumed.camp.stationsUnlocked.includes('raised_sleeping_platform'),
    'resumed camp_station_build should unlock station on completion',
  );
}

function runInterruptedPlayerDigResumeTest() {
  const state = createInitialGameState(4255, { width: 20, height: 20 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile for interrupted dig resume test');
  player.x = landTile.x;
  player.y = landTile.y;
  landTile.squirrelCache = null;

  const preview = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(preview.ok, true, 'dig should validate for interruption resume test');
  const actionId = preview.normalizedAction.actionId;

  const withInterruptedProgress = {
    ...state,
    actors: {
      ...state.actors,
      player: {
        ...state.actors.player,
        health: 0,
      },
    },
    pendingActionQueue: [
      {
        __inProgressAction: true,
        actionId,
        actorId: 'player',
        kind: 'dig',
        issuedAtTick: state.dayTick,
        normalizedAction: preview.normalizedAction,
        remainingTicks: 4,
        totalTicks: preview.normalizedAction.tickCost,
        budgetConsumed: true,
      },
    ],
  };

  const interrupted = advanceTick(withInterruptedProgress);
  const interruptedLog = interrupted.currentDayActionLog.find((entry) => entry.actionId === actionId);
  assert.ok(interruptedLog, 'interrupted in-progress dig should be logged');
  assert.equal(interruptedLog.status, 'interrupted', 'unavailable actor should interrupt in-progress dig');
  assert.equal(interrupted.pendingActionQueue.length, 1, 'interrupted dig should remain queued for resume');

  const tileAfterInterrupted = interrupted.tiles[landTile.y * interrupted.width + landTile.x];
  assert.equal(tileAfterInterrupted.disturbed, true, 'interrupted dig should mark tile disturbed immediately');
  assert.ok(tileAfterInterrupted.lastDigProgress, 'interrupted dig should record tile-level dig progress metadata');
  assert.equal(
    tileAfterInterrupted.lastDigProgress.ticksCompleted,
    Math.max(0, preview.normalizedAction.tickCost - 4),
    'interrupted dig should record completed ticks from carried in-progress state',
  );
  assert.equal(tileAfterInterrupted.lastDigProgress.ticksRemaining, 4, 'interrupted dig should preserve remaining ticks in progress metadata');

  assert.ok(interrupted.actors.player.lastDig, 'interrupted dig should update actor lastDig metadata');
  assert.equal(interrupted.actors.player.lastDig.ticksRemaining, 4, 'interrupted dig actor metadata should track remaining ticks');
  assert.equal(interrupted.actors.player.lastDig.interrupted, true, 'interrupted dig actor metadata should mark interrupted state');

  const resumedInput = {
    ...interrupted,
    actors: {
      ...interrupted.actors,
      player: {
        ...interrupted.actors.player,
        health: 1,
      },
    },
  };
  const resumed = advanceTick(resumedInput);

  const resumedLog = resumed.currentDayActionLog.find((entry) => entry.actionId === actionId && entry.status === 'applied');
  assert.ok(resumedLog, 'resumed in-progress dig should complete and be logged as applied');
  assert.equal(resumed.pendingActionQueue.length, 0, 'completed resumed dig should clear pending queue entry');

  const tileAfterResumed = resumed.tiles[landTile.y * resumed.width + landTile.x];
  assert.equal(tileAfterResumed.disturbed, true, 'resumed dig should disturb tile on completion');
}

function runDryingRackAndGroundDryingProgressionTest() {
  const dryableItemId = pickDryablePlantItemId();
  assert.ok(dryableItemId, 'test requires at least one dryable plant item in catalog');

  const state = createInitialGameState(4228, { width: 30, height: 30 });
  state.dailySunExposure = 0.5;
  state.dailyTemperatureBand = 'mild';
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_station_drying_rack: true,
  };
  state.camp.stockpile.stacks = [{ itemId: dryableItemId, quantity: 2, decayDaysRemaining: 10 }];

  const groundTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType && (tile.x !== state.camp.anchorX || tile.y !== state.camp.anchorY));
  assert.ok(groundTile, 'test requires a land tile for ground drying');
  const groundKey = `${groundTile.x},${groundTile.y}`;
  state.worldItemsByTile[groundKey] = [{ itemId: dryableItemId, quantity: 1, decayDaysRemaining: 10 }];

  const afterBuildAndLoad = advanceTick(state, {
    actions: [
      {
        actionId: 'build-drying-rack-functional',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'drying_rack' },
      },
      {
        actionId: 'load-drying-rack',
        actorId: 'player',
        kind: 'camp_drying_rack_add',
        payload: { itemId: dryableItemId, quantity: 1 },
      },
    ],
  });

  const rackSlots = afterBuildAndLoad.camp?.dryingRack?.slots || [];
  assert.equal(rackSlots.length, 1, 'camp_drying_rack_add should move one stack into rack slots');

  const afterDay = advanceTick(afterBuildAndLoad, { idleTicks: 300 });
  assert.ok(afterDay.dayTick >= 0 && afterDay.dayTick < 400, 'state should remain in valid dayTick bounds after rollover');

  const rackStack = (afterDay.camp?.dryingRack?.slots || [])[0];
  assert.ok(rackStack, 'drying rack stack should persist after one day');
  assert.ok(Math.abs(Number(rackStack.dryness) - 0.1) < 0.02, 'drying rack should accumulate dryness for fixed sun / idle window');
  assert.ok(Math.abs(Number(rackStack.decayDaysRemaining) - 9.03) < 0.07, 'rack drying should slow decay as dryness increases');

  const groundStacks = afterDay.worldItemsByTile[groundKey] || [];
  assert.equal(groundStacks.length, 1, 'ground drying stack should persist after one day');
  const groundDryness = Number(groundStacks[0].dryness);
  assert.ok(!Number.isFinite(groundDryness) || groundDryness < 0.08, 'ground dryness stays modest within this partial idle progression window');
  assert.ok(Math.abs(Number(groundStacks[0].decayDaysRemaining) - 9.078) < 0.08, 'ground exposure should slow decay according to dryness modifier');

  const afterUnload = advanceTick(afterDay, {
    actions: [
      {
        actionId: 'unload-drying-rack',
        actorId: 'player',
        kind: 'camp_drying_rack_remove',
        payload: { slotIndex: 0, quantity: 1 },
      },
    ],
  });
  const stockpileStack = afterUnload.camp.stockpile.stacks.find((entry) => entry.itemId === dryableItemId);
  assert.ok(stockpileStack, 'unloading drying rack should return item to stockpile');
  assert.ok(Number(stockpileStack.dryness) >= 0.09, 'returned stockpile item should preserve drying progress metadata');

  const gridState = createInitialGameState(4229, { width: 30, height: 30 });
  gridState.actors.player.x = gridState.camp.anchorX;
  gridState.actors.player.y = gridState.camp.anchorY;
  gridState.techUnlocks = {
    ...(gridState.techUnlocks || {}),
    unlock_station_drying_rack: true,
  };
  gridState.camp.stockpile.stacks = [
    { itemId: 'rack_large_2x2', quantity: 1, footprintW: 2, footprintH: 2, decayDaysRemaining: 10 },
    { itemId: 'rack_small_1x1', quantity: 1, footprintW: 1, footprintH: 1, decayDaysRemaining: 10 },
  ];

  const afterGridLoad = advanceTick(gridState, {
    actions: [
      {
        actionId: 'build-rack-grid',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'drying_rack' },
      },
      {
        actionId: 'load-large-2x2',
        actorId: 'player',
        kind: 'camp_drying_rack_add',
        payload: { itemId: 'rack_large_2x2', quantity: 1 },
      },
    ],
  });

  const rejectSmall = validateAction(afterGridLoad, {
    actorId: 'player',
    kind: 'camp_drying_rack_add',
    payload: { itemId: 'rack_small_1x1', quantity: 1 },
  });
  assert.equal(rejectSmall.ok, false, '2x2 drying rack should reject additional item when a 2x2 stack occupies all cells');
  assert.equal(rejectSmall.code, 'drying_rack_full', 'full 2x2 rack should return drying_rack_full');

  const directState = createInitialGameState(4230, { width: 30, height: 30 });
  directState.actors.player.x = directState.camp.anchorX;
  directState.actors.player.y = directState.camp.anchorY;
  directState.techUnlocks = {
    ...(directState.techUnlocks || {}),
    unlock_station_drying_rack: true,
  };
  directState.actors.player.inventory.stacks = [
    { itemId: 'inv_to_rack_item', quantity: 2, footprintW: 1, footprintH: 1, slotX: 0, slotY: 0, decayDaysRemaining: 10 },
  ];

  const afterDirect = advanceTick(directState, {
    actions: [
      {
        actionId: 'build-rack-direct',
        actorId: 'player',
        kind: 'camp_station_build',
        payload: { stationId: 'drying_rack' },
      },
      {
        actionId: 'move-direct-inventory-rack',
        actorId: 'player',
        kind: 'camp_drying_rack_add_inventory',
        payload: { itemId: 'inv_to_rack_item', quantity: 1 },
      },
    ],
  });

  const invAfterDirect = afterDirect.actors.player.inventory.stacks.find((entry) => entry.itemId === 'inv_to_rack_item');
  assert.ok(invAfterDirect, 'inventory stack should remain after partial direct transfer');
  assert.equal(invAfterDirect.quantity, 1, 'direct inventory->rack transfer should reduce actor inventory quantity');
  const rackAfterDirect = (afterDirect.camp?.dryingRack?.slots || []).find((entry) => entry.itemId === 'inv_to_rack_item');
  assert.ok(rackAfterDirect, 'direct inventory->rack transfer should add item to drying rack');
  assert.equal(rackAfterDirect.quantity, 1, 'direct inventory->rack transfer should move requested quantity');
}

function runPartnerTaskSetValidationTest() {
  const state = createInitialGameState(4208, { width: 30, height: 30 });

  const missingKind = validateAction(state, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        ticksRequired: 3,
      },
    },
  });
  assert.equal(missingKind.ok, false, 'partner_task_set should require task kind');
  assert.equal(missingKind.code, 'invalid_partner_task_kind', 'missing kind should reject with invalid_partner_task_kind');

  const invalidQueuePolicy = validateAction(state, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      queuePolicy: 'prepend',
      task: {
        kind: 'craft_rope',
        ticksRequired: 3,
      },
    },
  });
  assert.equal(invalidQueuePolicy.ok, false, 'partner_task_set should reject unsupported queue policy');
  assert.equal(
    invalidQueuePolicy.code,
    'invalid_partner_task_queue_policy',
    'invalid queue policy should reject with invalid_partner_task_queue_policy',
  );

  const valid = validateAction(state, {
    actionId: 'set-task-valid',
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        kind: 'craft_rope',
        ticksRequired: 4,
        outputs: [{ itemId: 'rope', quantity: 1, freshness: 1.2, decayDaysRemaining: 6 }],
      },
    },
  });

  assert.equal(valid.ok, true, 'partner_task_set should validate with kind + ticksRequired');
  assert.equal(
    valid.normalizedAction.payload.task.taskId,
    'set-task-valid:task',
    'partner_task_set should normalize stable taskId from actionId',
  );
  assert.equal(valid.normalizedAction.payload.queuePolicy, 'append', 'queuePolicy should default to append');
  assert.equal(
    valid.normalizedAction.payload.task.outputs[0].freshness,
    1,
    'task output freshness should be normalized into [0, 1]',
  );
  assert.equal(
    valid.normalizedAction.payload.task.outputs[0].decayDaysRemaining,
    6,
    'task output decayDaysRemaining should be preserved when valid',
  );
}

function runTechResearchPartnerTaskUnlockTest() {
  const state = createInitialGameState(42666, { width: 20, height: 20 });
  const forest = state.techForest;
  assert.ok(forest?.byUnlockKey, 'initial state should include techForest');
  const rootEntry = Object.entries(forest.byUnlockKey).find(([, meta]) => meta.depth === 0);
  assert.ok(rootEntry, 'forest should have at least one root node');
  const [rootKey, rootMeta] = rootEntry;
  assert.equal(state.techUnlocks[rootKey], false, 'root unlock should start false');

  const badTicks = validateAction(state, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        kind: TECH_RESEARCH_TASK_KIND,
        ticksRequired: 99999,
        meta: { unlockKey: rootKey },
      },
    },
  });
  assert.equal(badTicks.ok, false, 'wrong tick count should fail validation');
  assert.equal(badTicks.code, 'tech_research_tick_mismatch', 'should report tick mismatch');

  const tr = rootMeta.researchTicks;
  assert.ok(tr >= 2, 'test expects researchTicks >= 2 for progression split');
  let next = advanceTick(state, {
    actions: [
      {
        actionId: 'research-root',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          task: {
            taskId: 'tr-root',
            kind: TECH_RESEARCH_TASK_KIND,
            ticksRequired: tr,
            meta: { unlockKey: rootKey },
          },
        },
      },
    ],
    idleTicks: tr - 2,
  });
  assert.equal(next.techUnlocks[rootKey], false, 'root should not unlock before last tick');
  next = advanceTick(next, { idleTicks: 1 });
  assert.equal(next.techUnlocks[rootKey], true, 'tech_research completion should set unlock true');

  const toolRecipeId = findToolRecipeIdForUnlock(rootKey);
  if (toolRecipeId) {
    const craftGated = validateAction(next, {
      actorId: 'player',
      kind: 'tool_craft',
      payload: { recipeId: toolRecipeId },
    });
    assert.notEqual(
      craftGated.code,
      'missing_unlock',
      'recipe tied to researched tech should pass unlock gate (may fail for other reasons)',
    );
  }

  const childEntry = Object.entries(forest.byUnlockKey).find(
    ([, meta]) => meta.parentUnlockKey === rootKey,
  );
  if (childEntry) {
    const [childKey, childMeta] = childEntry;
    const okChild = validateAction(next, {
      actorId: 'player',
      kind: 'partner_task_set',
      payload: {
        task: {
          kind: TECH_RESEARCH_TASK_KIND,
          ticksRequired: childMeta.researchTicks,
          meta: { unlockKey: childKey },
        },
      },
    });
    assert.equal(okChild.ok, true, 'child research should validate once parent is researched');
  }

  const fresh = createInitialGameState(42667, { width: 20, height: 20 });
  const prereqChild = Object.entries(fresh.techForest.byUnlockKey).find(([, m]) => m.parentUnlockKey);
  if (prereqChild) {
    const [ck, cm] = prereqChild;
    const blocked = validateAction(fresh, {
      actorId: 'player',
      kind: 'partner_task_set',
      payload: {
        task: {
          kind: TECH_RESEARCH_TASK_KIND,
          ticksRequired: cm.researchTicks,
          meta: { unlockKey: ck },
        },
      },
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, 'tech_prerequisite_missing');
  }
}

function runPartnerTaskContinuousProgressionTest() {
  const state = createInitialGameState(4209, { width: 30, height: 30 });

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'set-partner-task',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          task: {
            taskId: 'rope-job',
            kind: 'craft_rope',
            ticksRequired: 3,
            outputs: [{ itemId: 'rope', quantity: 2 }],
          },
        },
      },
    ],
    idleTicks: 2,
  });

  const applied = next.currentDayActionLog.find((entry) => entry.actionId === 'set-partner-task');
  assert.ok(applied && applied.status === 'applied', 'partner_task_set action should be applied');

  assert.equal(next.camp.partnerTaskQueue.active, null, 'partner task should complete after enough ticks');
  assert.equal(next.camp.partnerTaskQueue.queued.length, 0, 'no queued partner tasks should remain');

  const ropeStack = next.camp.stockpile.stacks.find((entry) => entry.itemId === 'rope');
  assert.ok(ropeStack, 'completed partner task should deposit outputs into camp stockpile');
  assert.equal(ropeStack.quantity, 2, 'completed partner task should deposit configured quantity');

  assert.equal(next.actors.partner.taskQueue.active, null, 'partner actor taskQueue mirror should stay synchronized');
}

function runPartnerTaskQueuePolicyAndOutputStackingTest() {
  const state = createInitialGameState(4215, { width: 30, height: 30 });

  const queued = advanceTick(state, {
    actions: [
      {
        actionId: 'task-a',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          task: {
            taskId: 'task-a',
            kind: 'craft_rope',
            ticksRequired: 5,
            outputs: [{ itemId: 'rope', quantity: 1 }],
          },
        },
      },
      {
        actionId: 'task-b',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          task: {
            taskId: 'task-b',
            kind: 'craft_rope',
            ticksRequired: 5,
            outputs: [{ itemId: 'rope', quantity: 1 }],
          },
        },
      },
    ],
  });

  assert.equal(queued.camp.partnerTaskQueue.active.taskId, 'task-a', 'first task should be active under append policy');
  assert.equal(queued.camp.partnerTaskQueue.queued.length, 1, 'second task should be queued under append policy');

  const replaced = advanceTick(queued, {
    actions: [
      {
        actionId: 'task-replace',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          queuePolicy: 'replace',
          task: {
            taskId: 'task-replace',
            kind: 'craft_twine',
            ticksRequired: 2,
            outputs: [
              { itemId: 'fiber', quantity: 2, freshness: 0.2, decayDaysRemaining: 8 },
            ],
          },
        },
      },
    ],
  });

  assert.equal(
    replaced.camp.partnerTaskQueue.active.taskId,
    'task-replace',
    'replace policy should override currently active partner task',
  );
  assert.equal(
    replaced.camp.partnerTaskQueue.queued.length,
    0,
    'replace policy should clear queued partner tasks',
  );

  const firstCompletion = advanceTick(replaced, { idleTicks: 2 });
  const firstFiber = firstCompletion.camp.stockpile.stacks.find((entry) => entry.itemId === 'fiber');
  assert.ok(firstFiber, 'completed replacement task should deposit stockpile output');
  assert.equal(firstFiber.quantity, 2, 'first completion should deposit expected quantity');
  assert.equal(firstFiber.freshness, 0.2, 'first completion should set stockpile freshness');
  assert.ok(
    Math.abs(Number(firstFiber.decayDaysRemaining) - 8) < 0.05,
    'first completion should set stockpile decayDaysRemaining (fractional tick decay may shave a trace amount)',
  );

  const secondCompletion = advanceTick(firstCompletion, {
    actions: [
      {
        actionId: 'task-replace-2',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          queuePolicy: 'replace',
          task: {
            taskId: 'task-replace-2',
            kind: 'craft_twine',
            ticksRequired: 1,
            outputs: [
              { itemId: 'fiber', quantity: 4, freshness: 0.8, decayDaysRemaining: 2 },
            ],
          },
        },
      },
    ],
    idleTicks: 1,
  });

  const secondFiber = secondCompletion.camp.stockpile.stacks.find((entry) => entry.itemId === 'fiber');
  assert.equal(secondFiber.quantity, 6, 'stacking should aggregate repeated partner task outputs');
  assert.ok(
    Math.abs(secondFiber.freshness - 0.6) < 1e-9,
    'stacking should average freshness weighted by incoming quantity',
  );
  assert.ok(
    Math.abs(Number(secondFiber.decayDaysRemaining) - 4) < 0.08,
    'stacking should average decayDaysRemaining weighted by incoming quantity (tick decay may shift the blend slightly)',
  );
}

function runPartnerTaskStraddlesDayBoundaryTest() {
  const state = createInitialGameState(4250, { width: 30, height: 30 });
  state.dayTick = 398;
  state.camp.stationsUnlocked = ['sugar_boiling_station'];

  const interruptedAtRollover = advanceTick(state, {
    actions: [
      {
        actionId: 'set-boil-sap-day-edge',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          task: {
            taskId: 'boil-sap-day-edge',
            kind: 'boil_sap',
            ticksRequired: 4,
            outputs: [{ itemId: 'tree_sugar', quantity: 1 }],
          },
        },
      },
    ],
    idleTicks: 1,
  });

  assert.equal(interruptedAtRollover.dayTick, 0, 'task progression should roll into next day at boundary');
  assert.ok(interruptedAtRollover.camp.partnerTaskQueue.active, 'partner task should remain active after day rollover when incomplete');
  assert.equal(
    interruptedAtRollover.camp.partnerTaskQueue.active.ticksRemaining,
    2,
    'partner task should preserve remaining ticks across day rollover',
  );

  const outputBeforeComplete = interruptedAtRollover.camp.stockpile.stacks.find((entry) => entry.itemId === 'tree_sugar');
  assert.equal(outputBeforeComplete, undefined, 'incomplete boil_sap task should not produce output before completion');

  const resumedNextDay = advanceTick(interruptedAtRollover, { idleTicks: 2 });
  assert.equal(resumedNextDay.camp.partnerTaskQueue.active, null, 'partner task should complete after remaining ticks on following day');

  const outputAfterComplete = resumedNextDay.camp.stockpile.stacks.find((entry) => entry.itemId === 'tree_sugar');
  assert.ok(outputAfterComplete, 'completed boil_sap task should deposit output after resuming next day');
  assert.equal(outputAfterComplete.quantity, 1, 'completed boil_sap task should deposit configured quantity');
  assert.equal(resumedNextDay.actors.partner.taskQueue.active, null, 'partner actor queue mirror should stay synchronized after completion');
}

function runPartnerTaskInvalidatesOnMissingInputsTest() {
  const state = createInitialGameState(4251, { width: 30, height: 30 });
  state.actors.player.x = state.camp.anchorX;
  state.actors.player.y = state.camp.anchorY;
  state.camp.stockpile.stacks = [{ itemId: 'fiber', quantity: 1 }];

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'queue-input-dependent-task',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          task: {
            taskId: 'task-input',
            kind: 'craft_rope',
            ticksRequired: 4,
            inputs: [{ source: 'camp_stockpile', itemId: 'fiber', quantity: 1 }],
            outputs: [{ itemId: 'rope', quantity: 1 }],
          },
        },
      },
      {
        actionId: 'queue-fallback-task',
        actorId: 'player',
        kind: 'partner_task_set',
        payload: {
          task: {
            taskId: 'task-fallback',
            kind: 'craft_twine',
            ticksRequired: 1,
            outputs: [{ itemId: 'cordage', quantity: 1 }],
          },
        },
      },
      {
        actionId: 'remove-fiber',
        actorId: 'player',
        kind: 'camp_stockpile_remove',
        payload: {
          itemId: 'fiber',
          quantity: 1,
        },
      },
    ],
  });

  const ropeStack = next.camp.stockpile.stacks.find((entry) => entry.itemId === 'rope');
  assert.equal(ropeStack, undefined, 'invalidated input-dependent partner task should not produce outputs');

  const cordageStack = next.camp.stockpile.stacks.find((entry) => entry.itemId === 'cordage');
  assert.ok(cordageStack, 'next valid queued task should run after invalid task is dropped');
  assert.equal(cordageStack.quantity, 1, 'fallback task should produce expected output quantity');

  const history = Array.isArray(next.camp.partnerTaskHistory) ? next.camp.partnerTaskHistory : [];
  const failed = history.find((entry) => entry.taskId === 'task-input' && entry.status === 'failed');
  assert.ok(failed, 'invalidated partner task should be recorded as failed in partnerTaskHistory');
  assert.equal(failed.failureReason, 'missing_input:fiber', 'failed task should capture missing input reason');
}

function runInspectAndDigCoreEffectsTest() {
  const state = createInitialGameState(4210, { width: 30, height: 30 });
  const player = state.actors.player;

  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile');
  player.x = landTile.x;
  player.y = landTile.y;

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'inspect-here',
        actorId: 'player',
        kind: 'inspect',
        issuedAtTick: 0,
        payload: { x: landTile.x, y: landTile.y },
      },
      {
        actionId: 'dig-here',
        actorId: 'player',
        kind: 'dig',
        issuedAtTick: 1,
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  assert.equal(next.actors.player.lastInspection.x, landTile.x, 'inspect should record inspected x');
  assert.equal(next.actors.player.lastInspection.y, landTile.y, 'inspect should record inspected y');
  assert.equal(next.actors.player.lastDig.x, landTile.x, 'dig should record dig x');
  assert.equal(next.actors.player.lastDig.y, landTile.y, 'dig should record dig y');

  const postDigTile = next.tiles[landTile.y * next.width + landTile.x];
  assert.equal(postDigTile.disturbed, true, 'dig should mark target tile disturbed');
}

function runEatAndHarvestCoreEffectsTest() {
  const speciesId = 'daucus_carota';
  const species = PLANT_BY_ID[speciesId];
  const state = createInitialGameState(4211, { width: 20, height: 20 });
  state.dayOfYear = 6;
  state.plants = {};

  for (const tile of state.tiles) {
    tile.plantIds = [];
    tile.dormantSeeds = {};
    tile.waterType = null;
    tile.rockType = null;
    tile.baseShade = 0.2;
    tile.shade = 0.2;
  }

  const hostTile = state.tiles[8 * state.width + 8];
  hostTile.ph = (species.soil.ph_range[0] + species.soil.ph_range[1]) / 2;
  hostTile.fertility = (species.soil.fertility.tolerance_range[0] + species.soil.fertility.tolerance_range[1]) / 2;
  hostTile.moisture = (species.soil.moisture.tolerance_range[0] + species.soil.moisture.tolerance_range[1]) / 2;
  hostTile.drainage = 'well';
  hostTile.baseShade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;
  hostTile.shade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;

  state.plants.harvest_candidate = {
    id: 'harvest_candidate',
    speciesId,
    age: 47,
    x: hostTile.x,
    y: hostTile.y,
    stageName: 'second_year_vegetative',
    alive: true,
    vitality: 1,
    activeSubStages: [
      {
        partName: 'stem',
        subStageId: 'green',
        initialActionsRoll: 4,
        seasonalHarvestBudgetActions: 4,
        remainingActions: 4,
        harvestsThisSeason: 0,
        regrowthCountdown: null,
        vitalityDamageAppliedThisSeason: 0,
      },
    ],
    source: 'test',
  };
  hostTile.plantIds = ['harvest_candidate'];

  const player = state.actors.player;
  player.x = hostTile.x;
  player.y = hostTile.y;
  player.hunger = 0.4;
  player.thirst = 0.4;
  player.health = 0.4;
  player.inventory.stacks = [{ itemId: 'tree_sugar', quantity: 3 }];

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'eat-tree-sugar',
        actorId: 'player',
        kind: 'eat',
        issuedAtTick: 0,
        payload: { itemId: 'tree_sugar', quantity: 2 },
      },
      {
        actionId: 'harvest-stem',
        actorId: 'player',
        kind: 'harvest',
        issuedAtTick: 1,
        payload: {
          plantId: 'harvest_candidate',
          partName: 'stem',
          subStageId: 'green',
          actions: 2,
        },
      },
    ],
  });

  const sugarAfter = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tree_sugar');
  assert.equal(sugarAfter.quantity, 1, 'eat should consume requested inventory quantity');
  assert.ok(next.actors.player.hunger > 0.4, 'eat should increase hunger stat');
  assert.ok(next.actors.player.thirst > 0.4, 'eat should increase thirst stat');
  assert.ok(next.actors.player.health > 0.4, 'eat should increase health stat');

  const harvestItemId = 'daucus_carota:stem:green';
  const harvestedStack = next.actors.player.inventory.stacks.find((entry) => entry.itemId === harvestItemId);
  assert.ok(harvestedStack, 'harvest should add deterministic inventory item stack');
  assert.equal(
    harvestedStack.quantity,
    4,
    'harvest quantity should multiply applied actions by units_per_action midpoint (2 actions × 2 units)',
  );
  assert.ok(
    Number(next.plants.harvest_candidate.vitality) < 1,
    'harvest should apply vitality damage through applyHarvestAction',
  );
}

function runEatFieldEdibilityThresholdValidationTest() {
  const state = createInitialGameState(4290, { width: 20, height: 20 });
  const player = state.actors.player;

  const speciesId = 'test_field_edibility_species';
  const previousSpecies = PLANT_BY_ID[speciesId];
  PLANT_BY_ID[speciesId] = {
    id: speciesId,
    parts: [
      {
        name: 'leaf',
        subStages: [
          {
            id: 'low',
            edibility_score: 0.84,
          },
          {
            id: 'high',
            edibility_score: 0.9,
          },
        ],
      },
    ],
  };

  try {
    player.inventory.stacks = [
      { itemId: `${speciesId}:leaf:low`, quantity: 1 },
      { itemId: `${speciesId}:leaf:high`, quantity: 1 },
      { itemId: 'sylvilagus_floridanus:carcass', quantity: 1 },
    ];

    const lowValidation = validateAction(state, {
      actionId: 'eat-low-edibility',
      actorId: 'player',
      kind: 'eat',
      issuedAtTick: 0,
      payload: { itemId: `${speciesId}:leaf:low`, quantity: 1 },
    });
    assert.equal(lowValidation.ok, false, 'eat should reject field items below edibility threshold');
    assert.equal(lowValidation.code, 'item_not_field_edible', 'eat should report item_not_field_edible for low edibility');

    const highValidation = validateAction(state, {
      actionId: 'eat-high-edibility',
      actorId: 'player',
      kind: 'eat',
      issuedAtTick: 0,
      payload: { itemId: `${speciesId}:leaf:high`, quantity: 1 },
    });
    assert.equal(highValidation.ok, true, 'eat should allow field items at or above edibility threshold');

    const carcassValidation = validateAction(state, {
      actionId: 'eat-carcass',
      actorId: 'player',
      kind: 'eat',
      issuedAtTick: 0,
      payload: { itemId: 'sylvilagus_floridanus:carcass', quantity: 1 },
    });
    assert.equal(carcassValidation.ok, false, 'eat should reject carcass as not field edible');
    assert.equal(carcassValidation.code, 'item_not_field_edible', 'eat should gate carcass by field edibility threshold');
  } finally {
    if (previousSpecies) {
      PLANT_BY_ID[speciesId] = previousSpecies;
    } else {
      delete PLANT_BY_ID[speciesId];
    }
  }
}

function runAxeHarvestModifierAppliesTest() {
  const state = createInitialGameState(4267, { width: 20, height: 20 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires a land tile for axe harvest modifier checks');

  const speciesId = 'test_species_axe_modifier';
  const previousSpecies = PLANT_BY_ID[speciesId];
  PLANT_BY_ID[speciesId] = {
    id: speciesId,
    parts: [
      {
        name: 'bark',
        subStages: [
          {
            id: 'rough',
            harvest_base_ticks: 10,
            harvest_tool_modifiers: { axe: 0.4 },
          },
        ],
      },
    ],
  };

  try {
    state.plants = {
      axe_harvest_plant: {
        id: 'axe_harvest_plant',
        speciesId,
        age: 10,
        x: landTile.x,
        y: landTile.y,
        stageName: 'mature_vegetative',
        alive: true,
        vitality: 1,
        activeSubStages: [
          {
            partName: 'bark',
            subStageId: 'rough',
            initialActionsRoll: 3,
            seasonalHarvestBudgetActions: 3,
            remainingActions: 3,
            harvestsThisSeason: 0,
            regrowthCountdown: null,
            vitalityDamageAppliedThisSeason: 0,
          },
        ],
        source: 'test',
      },
    };
    landTile.plantIds = ['axe_harvest_plant'];

    player.x = landTile.x;
    player.y = landTile.y;
    player.inventory.stacks = [];

    const withoutAxe = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: {
        plantId: 'axe_harvest_plant',
        partName: 'bark',
        subStageId: 'rough',
        actions: 1,
      },
    });
    assert.equal(withoutAxe.ok, true, 'harvest should validate without axe');
    assert.equal(withoutAxe.normalizedAction.tickCost, 10, 'harvest should use base harvest_base_ticks without axe');

    player.inventory.stacks = [{ itemId: 'tool:axe', quantity: 1 }];
    const withAxe = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: {
        plantId: 'axe_harvest_plant',
        partName: 'bark',
        subStageId: 'rough',
        actions: 1,
      },
    });
    assert.equal(withAxe.ok, true, 'harvest should validate with axe');
    assert.equal(withAxe.normalizedAction.tickCost, 4, 'axe should apply harvest_tool_modifiers.axe to harvest tick cost');
  } finally {
    if (previousSpecies) {
      PLANT_BY_ID[speciesId] = previousSpecies;
    } else {
      delete PLANT_BY_ID[speciesId];
    }
  }
}

function runAxeKnifeHarvestModifierPrecedenceTest() {
  const state = createInitialGameState(4268, { width: 20, height: 20 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires a land tile for axe-knife precedence checks');

  const speciesId = 'test_species_axe_knife_precedence';
  const previousSpecies = PLANT_BY_ID[speciesId];
  PLANT_BY_ID[speciesId] = {
    id: speciesId,
    parts: [
      {
        name: 'bark',
        subStages: [
          {
            id: 'rough',
            harvest_base_ticks: 10,
            harvest_tool_modifiers: { axe: 0.4, knife: 0.5 },
          },
        ],
      },
    ],
  };

  try {
    state.plants = {
      axe_knife_harvest_plant: {
        id: 'axe_knife_harvest_plant',
        speciesId,
        age: 12,
        x: landTile.x,
        y: landTile.y,
        stageName: 'mature_vegetative',
        alive: true,
        vitality: 1,
        activeSubStages: [
          {
            partName: 'bark',
            subStageId: 'rough',
            initialActionsRoll: 3,
            seasonalHarvestBudgetActions: 3,
            remainingActions: 3,
            harvestsThisSeason: 0,
            regrowthCountdown: null,
            vitalityDamageAppliedThisSeason: 0,
          },
        ],
        source: 'test',
      },
    };
    landTile.plantIds = ['axe_knife_harvest_plant'];

    player.x = landTile.x;
    player.y = landTile.y;
    player.inventory.stacks = [{ itemId: 'tool:flint_knife', quantity: 1 }];

    const withKnifeOnly = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: {
        plantId: 'axe_knife_harvest_plant',
        partName: 'bark',
        subStageId: 'rough',
        actions: 1,
      },
    });
    assert.equal(withKnifeOnly.ok, true, 'harvest should validate with knife only');
    assert.equal(withKnifeOnly.normalizedAction.tickCost, 5, 'knife-only harvest should use knife modifier');

    player.inventory.stacks = [
      { itemId: 'tool:flint_knife', quantity: 1 },
      { itemId: 'tool:axe', quantity: 1 },
    ];
    const withBoth = validateAction(state, {
      actorId: 'player',
      kind: 'harvest',
      payload: {
        plantId: 'axe_knife_harvest_plant',
        partName: 'bark',
        subStageId: 'rough',
        actions: 1,
      },
    });
    assert.equal(withBoth.ok, true, 'harvest should validate with both knife and axe');
    assert.equal(withBoth.normalizedAction.tickCost, 4, 'harvest should pick best available tool modifier when multiple tools apply');
  } finally {
    if (previousSpecies) {
      PLANT_BY_ID[speciesId] = previousSpecies;
    } else {
      delete PLANT_BY_ID[speciesId];
    }
  }
}

function runEquipUnequipActionsTest() {
  const state = createInitialGameState(4270, { width: 20, height: 20 });
  const player = state.actors.player;
  player.inventory.stacks = [{ itemId: 'tool:gloves', quantity: 1, footprintW: 1, footprintH: 1 }];

  const equipPreview = validateAction(state, {
    actorId: 'player',
    kind: 'equip_item',
    payload: { itemId: 'tool:gloves' },
  });
  assert.equal(equipPreview.ok, true, 'equip_item should validate for carried equippable item');
  assert.equal(equipPreview.normalizedAction.payload.equipmentSlot, 'gloves', 'equip_item should normalize target slot');

  const equipped = advanceTick(state, {
    actions: [
      {
        actionId: 'equip-gloves',
        actorId: 'player',
        kind: 'equip_item',
        payload: { itemId: 'tool:gloves' },
      },
    ],
  });

  assert.equal(
    equipped.actors.player.inventory.stacks.some((entry) => entry.itemId === 'tool:gloves'),
    false,
    'equip_item should remove equipped item from stack inventory',
  );
  assert.equal(
    equipped.actors.player.inventory.equipment?.gloves?.itemId,
    'tool:gloves',
    'equip_item should store item in gloves equipment slot',
  );

  const unequipPreview = validateAction(equipped, {
    actorId: 'player',
    kind: 'unequip_item',
    payload: { equipmentSlot: 'gloves' },
  });
  assert.equal(unequipPreview.ok, true, 'unequip_item should validate for occupied equipment slot');

  const unequipped = advanceTick(equipped, {
    actions: [
      {
        actionId: 'unequip-gloves',
        actorId: 'player',
        kind: 'unequip_item',
        payload: { equipmentSlot: 'gloves' },
      },
    ],
  });

  assert.equal(unequipped.actors.player.inventory.equipment?.gloves, null, 'unequip_item should clear gloves equipment slot');
  const glovesStack = unequipped.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:gloves');
  assert.ok(glovesStack, 'unequip_item should restore gloves item to inventory stacks');
  assert.equal(glovesStack.quantity, 1, 'unequip_item should restore one gloves item');

  const coatState = createInitialGameState(4273, { width: 20, height: 20 });
  const coatPlayer = coatState.actors.player;
  coatPlayer.inventory.stacks = [{ itemId: 'tool:coat', quantity: 1, footprintW: 2, footprintH: 2 }];

  const coatEquipped = advanceTick(coatState, {
    actions: [
      {
        actionId: 'equip-coat',
        actorId: 'player',
        kind: 'equip_item',
        payload: { itemId: 'tool:coat' },
      },
    ],
  });
  assert.equal(
    coatEquipped.actors.player.inventory.equipment?.coat?.itemId,
    'tool:coat',
    'equip_item should support coat slot',
  );

  const coatUnequipped = advanceTick(coatEquipped, {
    actions: [
      {
        actionId: 'unequip-coat',
        actorId: 'player',
        kind: 'unequip_item',
        payload: { equipmentSlot: 'coat' },
      },
    ],
  });
  const coatStack = coatUnequipped.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:coat');
  assert.ok(coatStack, 'unequip_item should restore coat to inventory stacks');
  assert.equal(Number(coatStack.footprintW), 2, 'unequipped coat stack should preserve 2x2 footprint width');
  assert.equal(Number(coatStack.footprintH), 2, 'unequipped coat stack should preserve 2x2 footprint height');

  const hatState = createInitialGameState(4278, { width: 20, height: 20 });
  const hatPlayer = hatState.actors.player;
  hatPlayer.inventory.stacks = [{ itemId: 'tool:sun_hat', quantity: 1, footprintW: 1, footprintH: 1 }];

  const hatEquipped = advanceTick(hatState, {
    actions: [
      {
        actionId: 'equip-sun-hat',
        actorId: 'player',
        kind: 'equip_item',
        payload: { itemId: 'tool:sun_hat' },
      },
    ],
  });
  assert.equal(
    hatEquipped.actors.player.inventory.equipment?.head?.itemId,
    'tool:sun_hat',
    'equip_item should support head slot for tool:sun_hat',
  );

  const hatUnequipped = advanceTick(hatEquipped, {
    actions: [
      {
        actionId: 'unequip-sun-hat',
        actorId: 'player',
        kind: 'unequip_item',
        payload: { equipmentSlot: 'head' },
      },
    ],
  });
  const hatStack = hatUnequipped.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:sun_hat');
  assert.ok(hatStack, 'unequip_item should restore sun_hat to inventory stacks');
  assert.equal(Number(hatStack.footprintW), 1, 'unequipped sun_hat stack should preserve 1x1 footprint width');
  assert.equal(Number(hatStack.footprintH), 1, 'unequipped sun_hat stack should preserve 1x1 footprint height');
}

function runEquippedGlovesHarvestInjuryBehaviorTest() {
  const state = createInitialGameState(4271, { width: 20, height: 20 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires a land tile for equipped-gloves harvest injury checks');

  const speciesId = 'test_species_glove_harvest_injury';
  const previousSpecies = PLANT_BY_ID[speciesId];
  PLANT_BY_ID[speciesId] = {
    id: speciesId,
    parts: [
      {
        name: 'leaf',
        subStages: [
          {
            id: 'hazard',
            harvest_base_ticks: 2,
            harvest_tool_modifiers: {},
            harvest_damage: 0,
            on_harvest_injury: {
              type: 'sting',
              base_probability: 1,
              health_hit: 0.1,
              infection_chance: null,
              debuff: null,
              tool_probability_modifiers: {
                gloves: 0,
              },
            },
          },
        ],
      },
    ],
  };

  try {
    state.plants = {
      gloves_harvest_plant: {
        id: 'gloves_harvest_plant',
        speciesId,
        age: 5,
        x: landTile.x,
        y: landTile.y,
        stageName: 'mature_vegetative',
        alive: true,
        vitality: 1,
        activeSubStages: [
          {
            partName: 'leaf',
            subStageId: 'hazard',
            initialActionsRoll: 3,
            seasonalHarvestBudgetActions: 3,
            remainingActions: 3,
            harvestsThisSeason: 0,
            regrowthCountdown: null,
            vitalityDamageAppliedThisSeason: 0,
          },
        ],
        source: 'test',
      },
    };
    landTile.plantIds = ['gloves_harvest_plant'];

    player.x = landTile.x;
    player.y = landTile.y;
    player.health = 1;
    player.inventory.equipment = { gloves: null, coat: null };
    player.inventory.stacks = [{ itemId: 'tool:gloves', quantity: 1, footprintW: 1, footprintH: 1 }];

    const carriedOnly = advanceTick(state, {
      actions: [
        {
          actionId: 'harvest-carried-gloves-only',
          actorId: 'player',
          kind: 'harvest',
          payload: {
            plantId: 'gloves_harvest_plant',
            partName: 'leaf',
            subStageId: 'hazard',
            actions: 1,
          },
        },
      ],
    });

    assert.ok(
      carriedOnly.actors.player.health < 1,
      'gloves in stack inventory only should not suppress harvest injury',
    );

    const equippedState = createInitialGameState(4271, { width: 20, height: 20 });
    const equippedLandTile = equippedState.tiles.find((tile) => !tile.waterType && !tile.rockType);
    assert.ok(equippedLandTile, 'test requires second land tile setup for equipped-gloves harvest injury checks');
    equippedState.plants = {
      gloves_harvest_plant: {
        id: 'gloves_harvest_plant',
        speciesId,
        age: 5,
        x: equippedLandTile.x,
        y: equippedLandTile.y,
        stageName: 'mature_vegetative',
        alive: true,
        vitality: 1,
        activeSubStages: [
          {
            partName: 'leaf',
            subStageId: 'hazard',
            initialActionsRoll: 3,
            seasonalHarvestBudgetActions: 3,
            remainingActions: 3,
            harvestsThisSeason: 0,
            regrowthCountdown: null,
            vitalityDamageAppliedThisSeason: 0,
          },
        ],
        source: 'test',
      },
    };
    equippedLandTile.plantIds = ['gloves_harvest_plant'];
    equippedState.actors.player.health = 1;
    equippedState.actors.player.x = equippedLandTile.x;
    equippedState.actors.player.y = equippedLandTile.y;
    equippedState.actors.player.inventory.stacks = [{ itemId: 'tool:gloves', quantity: 1, footprintW: 1, footprintH: 1 }];
    equippedState.actors.player.inventory.equipment = { gloves: null, coat: null };

    const afterEquip = advanceTick(equippedState, {
      actions: [
        {
          actionId: 'equip-before-harvest',
          actorId: 'player',
          kind: 'equip_item',
          payload: { itemId: 'tool:gloves' },
        },
      ],
    });

    const protectedHarvest = advanceTick(afterEquip, {
      actions: [
        {
          actionId: 'harvest-with-equipped-gloves',
          actorId: 'player',
          kind: 'harvest',
          payload: {
            plantId: 'gloves_harvest_plant',
            partName: 'leaf',
            subStageId: 'hazard',
            actions: 1,
          },
        },
      ],
    });

    assert.equal(
      protectedHarvest.actors.player.health,
      1,
      'equipped gloves should suppress harvest injury when gloves modifier is 0',
    );
  } finally {
    if (previousSpecies) {
      PLANT_BY_ID[speciesId] = previousSpecies;
    } else {
      delete PLANT_BY_ID[speciesId];
    }
  }
}

function runEquippedCoatHarvestInjuryBehaviorTest() {
  const state = createInitialGameState(4274, { width: 20, height: 20 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires a land tile for equipped-coat harvest injury checks');

  const speciesId = 'test_species_coat_harvest_injury';
  const previousSpecies = PLANT_BY_ID[speciesId];
  PLANT_BY_ID[speciesId] = {
    id: speciesId,
    parts: [
      {
        name: 'stem',
        subStages: [
          {
            id: 'hazard',
            harvest_base_ticks: 2,
            harvest_tool_modifiers: {},
            harvest_damage: 0,
            on_harvest_injury: {
              type: 'scratch',
              base_probability: 1,
              health_hit: 0.1,
              infection_chance: null,
              debuff: null,
              tool_probability_modifiers: {
                coat: 0,
              },
            },
          },
        ],
      },
    ],
  };

  try {
    state.plants = {
      coat_harvest_plant: {
        id: 'coat_harvest_plant',
        speciesId,
        age: 5,
        x: landTile.x,
        y: landTile.y,
        stageName: 'mature_vegetative',
        alive: true,
        vitality: 1,
        activeSubStages: [
          {
            partName: 'stem',
            subStageId: 'hazard',
            initialActionsRoll: 3,
            seasonalHarvestBudgetActions: 3,
            remainingActions: 3,
            harvestsThisSeason: 0,
            regrowthCountdown: null,
            vitalityDamageAppliedThisSeason: 0,
          },
        ],
        source: 'test',
      },
    };
    landTile.plantIds = ['coat_harvest_plant'];

    player.x = landTile.x;
    player.y = landTile.y;
    player.health = 1;
    player.inventory.equipment = { gloves: null, coat: null };
    player.inventory.stacks = [{ itemId: 'tool:coat', quantity: 1, footprintW: 2, footprintH: 2 }];

    const carriedOnly = advanceTick(state, {
      actions: [
        {
          actionId: 'harvest-carried-coat-only',
          actorId: 'player',
          kind: 'harvest',
          payload: {
            plantId: 'coat_harvest_plant',
            partName: 'stem',
            subStageId: 'hazard',
            actions: 1,
          },
        },
      ],
    });

    assert.ok(
      carriedOnly.actors.player.health < 1,
      'coat in stack inventory only should not suppress harvest injury',
    );

    const equippedState = createInitialGameState(4274, { width: 20, height: 20 });
    const equippedLandTile = equippedState.tiles.find((tile) => !tile.waterType && !tile.rockType);
    assert.ok(equippedLandTile, 'test requires second land tile setup for equipped-coat harvest injury checks');
    equippedState.plants = {
      coat_harvest_plant: {
        id: 'coat_harvest_plant',
        speciesId,
        age: 5,
        x: equippedLandTile.x,
        y: equippedLandTile.y,
        stageName: 'mature_vegetative',
        alive: true,
        vitality: 1,
        activeSubStages: [
          {
            partName: 'stem',
            subStageId: 'hazard',
            initialActionsRoll: 3,
            seasonalHarvestBudgetActions: 3,
            remainingActions: 3,
            harvestsThisSeason: 0,
            regrowthCountdown: null,
            vitalityDamageAppliedThisSeason: 0,
          },
        ],
        source: 'test',
      },
    };
    equippedLandTile.plantIds = ['coat_harvest_plant'];
    equippedState.actors.player.health = 1;
    equippedState.actors.player.x = equippedLandTile.x;
    equippedState.actors.player.y = equippedLandTile.y;
    equippedState.actors.player.inventory.stacks = [{ itemId: 'tool:coat', quantity: 1, footprintW: 2, footprintH: 2 }];
    equippedState.actors.player.inventory.equipment = { gloves: null, coat: null };

    const afterEquip = advanceTick(equippedState, {
      actions: [
        {
          actionId: 'equip-coat-before-harvest',
          actorId: 'player',
          kind: 'equip_item',
          payload: { itemId: 'tool:coat' },
        },
      ],
    });

    const protectedHarvest = advanceTick(afterEquip, {
      actions: [
        {
          actionId: 'harvest-with-equipped-coat',
          actorId: 'player',
          kind: 'harvest',
          payload: {
            plantId: 'coat_harvest_plant',
            partName: 'stem',
            subStageId: 'hazard',
            actions: 1,
          },
        },
      ],
    });

    assert.equal(
      protectedHarvest.actors.player.health,
      1,
      'equipped coat should suppress harvest injury when coat modifier is 0',
    );
  } finally {
    if (previousSpecies) {
      PLANT_BY_ID[speciesId] = previousSpecies;
    } else {
      delete PLANT_BY_ID[speciesId];
    }
  }
}

function runEquipmentSnapshotRoundTripTest() {
  const state = createInitialGameState(4272, { width: 20, height: 20 });
  state.actors.player.inventory.equipment = {
    gloves: { itemId: 'tool:gloves', equippedAtDay: 3, equippedAtDayTick: 12 },
    coat: { itemId: 'tool:coat', equippedAtDay: 4, equippedAtDayTick: 7 },
    head: { itemId: 'tool:sun_hat', equippedAtDay: 5, equippedAtDayTick: 9 },
  };

  const payload = serializeGameState(state);
  const loaded = deserializeGameState(payload);
  assert.equal(loaded.actors.player.inventory.equipment?.gloves?.itemId, 'tool:gloves', 'snapshot round-trip should preserve equipped gloves');
  assert.equal(loaded.actors.player.inventory.equipment?.coat?.itemId, 'tool:coat', 'snapshot round-trip should preserve equipped coat');
  assert.equal(loaded.actors.player.inventory.equipment?.head?.itemId, 'tool:sun_hat', 'snapshot round-trip should preserve equipped sun hat');
}

function runCoatColdExposurePerTickTest() {
  const exposureTicks = 120;
  const expectedDrain = (1 / 3) * (exposureTicks / 400);

  const unprotected = createInitialGameState(4275, { width: 20, height: 20 });
  unprotected.dailyTemperatureBand = 'freezing';
  unprotected.dailyTemperatureF = 20;
  unprotected.actors.player.health = 1;
  unprotected.actors.player.inventory.equipment = { gloves: null, coat: null };
  unprotected.actors.player.x = unprotected.camp.anchorX + 1;
  unprotected.actors.player.y = unprotected.camp.anchorY;

  const afterExposure = advanceTick(unprotected, { idleTicks: exposureTicks });
  assert.ok(
    Math.abs(afterExposure.actors.player.health - (1 - expectedDrain)) < 1e-9,
    'freezing exposure without coat should drain health gradually per tick',
  );

  const protectedState = createInitialGameState(4276, { width: 20, height: 20 });
  protectedState.dailyTemperatureBand = 'freezing';
  protectedState.dailyTemperatureF = 20;
  protectedState.actors.player.health = 1;
  protectedState.actors.player.inventory.equipment = {
    gloves: null,
    coat: { itemId: 'tool:coat', equippedAtDay: 0, equippedAtDayTick: 0 },
  };
  protectedState.actors.player.x = protectedState.camp.anchorX + 1;
  protectedState.actors.player.y = protectedState.camp.anchorY;

  const afterProtectedExposure = advanceTick(protectedState, { idleTicks: exposureTicks });
  assert.equal(
    afterProtectedExposure.actors.player.health,
    1,
    'equipped coat should prevent freezing-band cold exposure drain',
  );

  const campSafe = createInitialGameState(4277, { width: 20, height: 20 });
  campSafe.dailyTemperatureBand = 'cold';
  campSafe.dailyTemperatureF = 30;
  campSafe.actors.player.health = 1;
  campSafe.actors.player.inventory.equipment = { gloves: null, coat: null };
  campSafe.actors.player.x = campSafe.camp.anchorX;
  campSafe.actors.player.y = campSafe.camp.anchorY;

  const afterCampIdle = advanceTick(campSafe, { idleTicks: exposureTicks });
  assert.equal(
    afterCampIdle.actors.player.health,
    1,
    'player on camp anchor should not take cold exposure damage',
  );
}

function runTemperatureThirstDrainAndSunHatModifierTest() {
  const idleTicks = 120;
  const startThirst = 1;

  function runScenario(seed, band, withSunHat = false, atCamp = false) {
    const state = createInitialGameState(seed, { width: 20, height: 20 });
    state.dailyTemperatureBand = band;
    state.actors.player.thirst = startThirst;
    state.actors.player.inventory.equipment = {
      gloves: null,
      coat: null,
      head: withSunHat ? { itemId: 'tool:sun_hat', equippedAtDay: 0, equippedAtDayTick: 0 } : null,
    };
    state.actors.player.x = atCamp ? state.camp.anchorX : state.camp.anchorX + 1;
    state.actors.player.y = state.camp.anchorY;
    return advanceTick(state, { idleTicks });
  }

  const mild = runScenario(4280, 'mild');
  const warm = runScenario(4281, 'warm');
  const warmWithHat = runScenario(4282, 'warm', true);
  const hot = runScenario(4283, 'hot');
  const hotWithHat = runScenario(4284, 'hot', true);
  const freezing = runScenario(4285, 'freezing');
  const warmAtCamp = runScenario(4286, 'warm', false, true);

  const mildDrain = startThirst - mild.actors.player.thirst;
  const warmDrain = startThirst - warm.actors.player.thirst;
  const warmWithHatDrain = startThirst - warmWithHat.actors.player.thirst;
  const hotDrain = startThirst - hot.actors.player.thirst;
  const hotWithHatDrain = startThirst - hotWithHat.actors.player.thirst;
  const freezingDrain = startThirst - freezing.actors.player.thirst;
  const warmAtCampDrain = startThirst - warmAtCamp.actors.player.thirst;

  assert.ok(warmDrain > mildDrain, 'warm band should drain thirst faster than mild');
  assert.ok(hotDrain > warmDrain, 'hot band should drain thirst faster than warm');
  assert.ok(freezingDrain < mildDrain, 'freezing band should drain thirst slower than mild');

  const expectedWarmWithHatDrain = mildDrain + ((warmDrain - mildDrain) * 0.5);
  const expectedHotWithHatDrain = mildDrain + ((hotDrain - mildDrain) * 0.5);
  assert.ok(
    Math.abs(warmWithHatDrain - expectedWarmWithHatDrain) < 1e-9,
    'equipped sun_hat should halve warm temperature thirst modifier',
  );
  assert.ok(
    Math.abs(hotWithHatDrain - expectedHotWithHatDrain) < 1e-9,
    'equipped sun_hat should halve hot temperature thirst modifier',
  );
  assert.equal(
    warmAtCampDrain,
    0,
    'player on camp anchor should not lose thirst from field activity tick drain',
  );
}

function runEatFilledSapVesselReturnsEmptyContainerTest() {
  const state = createInitialGameState(4214, { width: 20, height: 20 });
  const player = state.actors.player;
  player.hunger = 0.4;
  player.thirst = 0.4;
  player.health = 0.4;
  player.inventory.stacks = [
    {
      itemId: 'tool:hide_pitch_vessel_filled_sap',
      quantity: 2,
      footprintW: 1,
      footprintH: 1,
      slotX: 0,
      slotY: 0,
    },
    {
      itemId: 'tool:hide_pitch_vessel',
      quantity: 1,
      footprintW: 1,
      footprintH: 1,
      slotX: 1,
      slotY: 0,
    },
  ];

  const preview = validateAction(state, {
    actorId: 'player',
    kind: 'eat',
    payload: {
      itemId: 'tool:hide_pitch_vessel_filled_sap',
      quantity: 2,
    },
  });
  assert.equal(preview.ok, true, 'eat should validate for filled sap vessel inventory item');
  assert.ok(
    Array.isArray(preview.normalizedAction.payload.returnItems)
      && preview.normalizedAction.payload.returnItems.some((entry) => entry.itemId === 'tool:hide_pitch_vessel' && entry.quantity === 2),
    'eat preview should normalize returnItems for filled sap vessels',
  );

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'drink-sap-from-vessel',
        actorId: 'player',
        kind: 'eat',
        payload: {
          itemId: 'tool:hide_pitch_vessel_filled_sap',
          quantity: 2,
        },
      },
    ],
  });

  const filledAfter = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:hide_pitch_vessel_filled_sap');
  assert.equal(filledAfter, undefined, 'eat should consume filled sap vessels');

  const emptyAfter = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'tool:hide_pitch_vessel');
  assert.ok(emptyAfter, 'eat should return empty vessel containers for filled sap vessel inputs');
  assert.equal(emptyAfter.quantity, 3, 'eat should preserve existing empty vessels and add returned vessels');

  assert.ok(next.actors.player.hunger > 0.4, 'eat should increase hunger when drinking sap from vessel');
  assert.ok(next.actors.player.thirst > 0.4, 'eat should increase thirst when drinking sap from vessel');
  assert.ok(next.actors.player.health > 0.4, 'eat should increase health when drinking sap from vessel');
}

function runWaterskinFillAndDrinkValidationTest() {
  const state = createInitialGameState(5390, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = findCardinalAdjacentWaterLandTile(state);
  assert.ok(landTile, 'test requires land tile cardinally adjacent to unfrozen water for waterskin actions');

  player.x = landTile.x;
  player.y = landTile.y;
  player.inventory.stacks = [];

  const fillMissing = validateAction(state, {
    actorId: 'player',
    kind: 'waterskin_fill',
    payload: {},
  });
  assert.equal(fillMissing.ok, false, 'waterskin_fill should require carried waterskin');
  assert.equal(fillMissing.code, 'insufficient_item_quantity', 'waterskin_fill missing container should return insufficient_item_quantity');

  player.inventory.stacks = [{ itemId: 'tool:waterskin', quantity: 1 }];
  const fillValid = validateAction(state, {
    actorId: 'player',
    kind: 'waterskin_fill',
    payload: {},
  });
  assert.equal(fillValid.ok, true, 'waterskin_fill should validate with empty waterskin and adjacent water');
  assert.equal(fillValid.normalizedAction.tickCost, 2, 'waterskin_fill should normalize to 2 tick cost');
  assert.ok(typeof fillValid.normalizedAction.payload.toItemId === 'string', 'waterskin_fill should normalize output waterskin state item id');

  const drinkMissing = validateAction(state, {
    actorId: 'player',
    kind: 'waterskin_drink',
    payload: {},
  });
  assert.equal(drinkMissing.ok, false, 'waterskin_drink should reject when no filled waterskin carried');
  assert.equal(drinkMissing.code, 'insufficient_item_quantity', 'waterskin_drink missing filled waterskin should return insufficient_item_quantity');

  player.inventory.stacks = [{ itemId: 'tool:waterskin_safe_2', quantity: 1 }];
  const drinkValid = validateAction(state, {
    actorId: 'player',
    kind: 'waterskin_drink',
    payload: {},
  });
  assert.equal(drinkValid.ok, true, 'waterskin_drink should validate with filled waterskin');
  assert.equal(drinkValid.normalizedAction.tickCost, 1, 'waterskin_drink should normalize to 1 tick cost');
  assert.equal(drinkValid.normalizedAction.payload.toItemId, 'tool:waterskin_safe_1', 'waterskin_drink should decrement waterskin drink state');

  const waterTile = findAdjacentTileMatching(state, landTile, (tile) => tile?.waterType && tile.waterFrozen !== true);
  assert.ok(waterTile, 'test requires adjacent unfrozen water tile for water_drink');

  const farX = landTile.x + 2 < state.width ? landTile.x + 2 : landTile.x - 2;
  const drinkWaterTooFar = validateAction(state, {
    actorId: 'player',
    kind: 'water_drink',
    payload: { x: farX, y: landTile.y },
  });
  assert.equal(drinkWaterTooFar.ok, false, 'water_drink should reject non-adjacent water tile');
  assert.equal(drinkWaterTooFar.code, 'interaction_out_of_range', 'water_drink out of range should return interaction_out_of_range');

  const drinkWaterValid = validateAction(state, {
    actorId: 'player',
    kind: 'water_drink',
    payload: { x: waterTile.x, y: waterTile.y },
  });
  assert.equal(drinkWaterValid.ok, true, 'water_drink should validate when standing next to river or pond');
  assert.equal(drinkWaterValid.normalizedAction.tickCost, 1, 'water_drink should cost 1 tick');
  assert.ok(
    drinkWaterValid.normalizedAction.payload.sourceType === 'pond'
      || drinkWaterValid.normalizedAction.payload.sourceType === 'river',
    'water_drink should normalize sourceType from tile',
  );

  player.thirst = 0.1;
  const drank = advanceTick(state, {
    actions: [
      {
        actionId: 'direct-water-drink-test',
        actorId: 'player',
        kind: 'water_drink',
        payload: { x: waterTile.x, y: waterTile.y },
      },
    ],
  });
  assert.ok(
    drank.actors.player.thirst >= 1 - 2 / 600,
    'water_drink should restore thirst to full, allowing same-tick field thirst drain after the action',
  );

  const campState = createInitialGameState(5392, { width: 30, height: 30 });
  const campPlayer = campState.actors.player;
  const ax = campState.camp.anchorX;
  const ay = campState.camp.anchorY;
  assert.ok(Number.isInteger(ax) && Number.isInteger(ay), 'test requires camp anchor');
  campPlayer.x = ax;
  campPlayer.y = ay;
  const campDrinkValid = validateAction(campState, {
    actorId: 'player',
    kind: 'water_drink',
    payload: { x: ax, y: ay },
  });
  assert.equal(campDrinkValid.ok, true, 'water_drink should validate on camp anchor tile');
  assert.equal(
    campDrinkValid.normalizedAction.payload.sourceType,
    'safe',
    'camp water_drink should normalize sourceType safe',
  );

  const stepX = ax + 1 < campState.width ? 1 : -1;
  campPlayer.x = ax + stepX;
  campPlayer.y = ay;
  const campDrinkAdjacent = validateAction(campState, {
    actorId: 'player',
    kind: 'water_drink',
    payload: { x: ax, y: ay },
  });
  assert.equal(campDrinkAdjacent.ok, true, 'water_drink should validate from tile adjacent to camp anchor');

  const campFarX = ax + 2 * stepX;
  if (campFarX >= 0 && campFarX < campState.width) {
    campPlayer.x = campFarX;
    campPlayer.y = ay;
    const campDrinkTooFar = validateAction(campState, {
      actorId: 'player',
      kind: 'water_drink',
      payload: { x: ax, y: ay },
    });
    assert.equal(campDrinkTooFar.ok, false, 'water_drink camp target should reject when player not in range');
    assert.equal(campDrinkTooFar.code, 'interaction_out_of_range', 'camp water_drink out of range should match other tile drinks');
  }

  campPlayer.x = ax;
  campPlayer.y = ay;
  campPlayer.thirst = 0.15;
  const campDrank = advanceTick(campState, {
    actions: [
      {
        actionId: 'camp-water-drink-runtime',
        actorId: 'player',
        kind: 'water_drink',
        payload: { x: ax, y: ay },
      },
    ],
  });
  assert.ok(campDrank.actors.player.thirst >= 0.99, 'camp water_drink should restore thirst');
  assert.equal(
    Array.isArray(campDrank.actors.player.conditions)
      && campDrank.actors.player.conditions.some((c) => c?.condition_id === 'gut_illness'),
    false,
    'camp safe water should not apply gut illness',
  );
}

function runWaterskinFillDrinkRuntimeAndGutIllnessTest() {
  const base = createInitialGameState(5391, { width: 30, height: 30 });
  const landTile = findCardinalAdjacentWaterLandTile(base);
  assert.ok(landTile, 'test requires land tile cardinally adjacent to unfrozen water for waterskin runtime');
  const waterTile = findAdjacentTileMatching(base, landTile, (tile) => tile?.waterType && tile.waterFrozen !== true);
  assert.ok(waterTile, 'test requires adjacent unfrozen water tile for waterskin runtime');

  const safeState = deserializeGameState(serializeGameState(base));
  const safePlayer = safeState.actors.player;
  safePlayer.x = landTile.x;
  safePlayer.y = landTile.y;
  safePlayer.thirst = 0;
  safePlayer.inventory.stacks = [{ itemId: 'tool:waterskin_safe_3', quantity: 1 }];

  const safeDrank = advanceTick(safeState, {
    actions: [
      {
        actionId: 'waterskin-safe-drink',
        actorId: 'player',
        kind: 'waterskin_drink',
        payload: {},
      },
    ],
  });

  assert.ok(safeDrank.actors.player.thirst > 0, 'waterskin_drink should restore thirst at runtime');
  assert.equal(
    safeDrank.actors.player.inventory.stacks.some((entry) => entry.itemId === 'tool:waterskin_safe_2'),
    true,
    'waterskin_drink should decrement waterskin state in inventory',
  );
  assert.equal(
    Array.isArray(safeDrank.actors.player.conditions) && safeDrank.actors.player.conditions.some((entry) => entry?.condition_id === 'gut_illness'),
    false,
    'safe waterskin source should not apply gut illness condition',
  );

  const fillState = deserializeGameState(serializeGameState(base));
  const fillPlayer = fillState.actors.player;
  fillPlayer.x = landTile.x;
  fillPlayer.y = landTile.y;
  fillPlayer.inventory.stacks = [{ itemId: 'tool:waterskin', quantity: 1 }];

  const filled = advanceTick(fillState, {
    actions: [
      {
        actionId: 'waterskin-fill-adjacent',
        actorId: 'player',
        kind: 'waterskin_fill',
        payload: {},
      },
    ],
  });

  const expectedPrefix = waterTile.waterType === 'pond' ? 'tool:waterskin_pond_3' : 'tool:waterskin_river_3';
  assert.equal(
    filled.actors.player.inventory.stacks.some((entry) => entry.itemId === expectedPrefix),
    true,
    'waterskin_fill should convert to full waterskin with source-typed water',
  );

  let pondIllnessFound = null;
  for (let seed = 5400; seed < 5480; seed += 1) {
    const attempt = createInitialGameState(seed, { width: 30, height: 30 });
    const attemptLand = findCardinalAdjacentWaterLandTile(attempt);
    if (!attemptLand) {
      continue;
    }
    const attemptPond = findAdjacentTileMatching(attempt, attemptLand, (tile) => tile?.waterType === 'pond' && tile.waterFrozen !== true);
    if (!attemptPond) {
      continue;
    }

    const attemptPlayer = attempt.actors.player;
    attemptPlayer.x = attemptLand.x;
    attemptPlayer.y = attemptLand.y;
    attemptPlayer.inventory.stacks = [{ itemId: 'tool:waterskin_pond_1', quantity: 1 }];

    const drank = advanceTick(attempt, {
      actions: [
        {
          actionId: `waterskin-pond-drink-${seed}`,
          actorId: 'player',
          kind: 'waterskin_drink',
          payload: {},
        },
      ],
    });

    if (Array.isArray(drank.actors.player.conditions)
      && drank.actors.player.conditions.some((entry) => entry?.condition_id === 'gut_illness')) {
      pondIllnessFound = drank;
      break;
    }
  }

  assert.ok(pondIllnessFound, 'pond-source waterskin drinking should deterministically produce at least one gut illness case across seeds');
  const gutIllness = pondIllnessFound.actors.player.conditions.find((entry) => entry?.condition_id === 'gut_illness');
  assert.ok(gutIllness, 'gut illness condition should be present after successful pond illness roll');
  assert.ok(gutIllness.duration_days_remaining >= 2 && gutIllness.duration_days_remaining <= 4, 'gut illness duration should be in 2-4 day range');
  assert.deepEqual(gutIllness.treatable_by, ['tannin_tea'], 'gut illness treatment tag should match tannin tea');
}

function runCampStockpileTransferActionsTest() {
  const state = createInitialGameState(4216, { width: 30, height: 30 });
  const player = state.actors.player;
  player.inventory.stacks = [
    {
      itemId: 'nuts',
      quantity: 5,
      freshness: 0.4,
      decayDaysRemaining: 9,
    },
  ];

  const removeMissing = validateAction(state, {
    actorId: 'player',
    kind: 'camp_stockpile_remove',
    payload: { itemId: 'nuts', quantity: 1 },
  });
  assert.equal(removeMissing.ok, false, 'camp_stockpile_remove should reject when stockpile is empty');
  assert.equal(
    removeMissing.code,
    'insufficient_stockpile_quantity',
    'camp_stockpile_remove should return insufficient_stockpile_quantity when item absent',
  );

  const addMissing = validateAction(state, {
    actorId: 'player',
    kind: 'camp_stockpile_add',
    payload: { itemId: 'roots', quantity: 1 },
  });
  assert.equal(addMissing.ok, false, 'camp_stockpile_add should reject missing actor inventory quantity');
  assert.equal(addMissing.code, 'insufficient_item_quantity', 'camp_stockpile_add should return insufficient_item_quantity');

  const afterAdd = advanceTick(state, {
    actions: [
      {
        actionId: 'stock-add',
        actorId: 'player',
        kind: 'camp_stockpile_add',
        payload: { itemId: 'nuts', quantity: 3 },
      },
    ],
  });

  const invAfterAdd = afterAdd.actors.player.inventory.stacks.find((entry) => entry.itemId === 'nuts');
  const campAfterAdd = afterAdd.camp.stockpile.stacks.find((entry) => entry.itemId === 'nuts');
  assert.equal(invAfterAdd.quantity, 2, 'camp_stockpile_add should remove quantity from actor inventory');
  assert.equal(campAfterAdd.quantity, 3, 'camp_stockpile_add should add quantity into camp stockpile');
  assert.equal(campAfterAdd.freshness, 0.4, 'camp_stockpile_add should preserve freshness metadata');
  assert.ok(
    Math.abs(Number(campAfterAdd.decayDaysRemaining) - 9) < 0.05,
    'camp_stockpile_add should preserve decay metadata (fractional tick decay may apply during transfer tick)',
  );

  const afterRemove = advanceTick(afterAdd, {
    actions: [
      {
        actionId: 'stock-remove',
        actorId: 'player',
        kind: 'camp_stockpile_remove',
        payload: { itemId: 'nuts', quantity: 2 },
      },
    ],
  });

  const invAfterRemove = afterRemove.actors.player.inventory.stacks.find((entry) => entry.itemId === 'nuts');
  const campAfterRemove = afterRemove.camp.stockpile.stacks.find((entry) => entry.itemId === 'nuts');
  assert.equal(invAfterRemove.quantity, 4, 'camp_stockpile_remove should add quantity back to actor inventory');
  assert.equal(campAfterRemove.quantity, 1, 'camp_stockpile_remove should reduce camp stockpile quantity');
  assert.equal(invAfterRemove.freshness, 0.4, 'camp_stockpile_remove should preserve freshness on transfer back');
  assert.ok(
    Math.abs(Number(invAfterRemove.decayDaysRemaining) - 9) < 0.05,
    'camp_stockpile_remove should preserve decayDaysRemaining on transfer back (fractional tick decay may apply)',
  );
}

function runNoImplicitDryWetStackMergeTest() {
  const state = createInitialGameState(4231, { width: 30, height: 30 });
  const player = state.actors.player;
  player.x = state.camp.anchorX;
  player.y = state.camp.anchorY;

  player.inventory.stacks = [
    {
      itemId: 'venison_strip',
      quantity: 2,
      decayDaysRemaining: 8,
      dryness: 0.2,
      footprintW: 1,
      footprintH: 1,
      slotX: 0,
      slotY: 0,
    },
    {
      itemId: 'venison_strip',
      quantity: 2,
      decayDaysRemaining: 8,
      dryness: 1,
      footprintW: 1,
      footprintH: 1,
      slotX: 1,
      slotY: 0,
    },
  ];

  state.camp.stockpile.stacks = [
    {
      itemId: 'venison_strip',
      quantity: 1,
      decayDaysRemaining: 8,
      dryness: 1,
      footprintW: 1,
      footprintH: 1,
    },
  ];

  const afterAddWet = advanceTick(state, {
    actions: [
      {
        actionId: 'stock-add-wet-venison',
        actorId: 'player',
        kind: 'camp_stockpile_add',
        payload: { itemId: 'venison_strip', quantity: 2 },
      },
    ],
  });

  const stockpileVenisonAfterAdd = afterAddWet.camp.stockpile.stacks.filter((entry) => entry.itemId === 'venison_strip');
  assert.equal(stockpileVenisonAfterAdd.length, 2, 'stockpile should keep wet and fully dry venison in separate stacks');
  const dryInStockpile = stockpileVenisonAfterAdd.find((entry) => Number(entry.dryness) >= 0.999999);
  const wetInStockpile = stockpileVenisonAfterAdd.find((entry) => Number(entry.dryness) < 0.999999);
  assert.ok(dryInStockpile, 'stockpile should retain a fully dry venison stack');
  assert.ok(wetInStockpile, 'stockpile add should create a distinct wet venison stack instead of merging into dry');
  assert.equal(dryInStockpile.quantity, 1, 'existing fully dry stockpile stack quantity should remain unchanged by wet transfer');
  assert.equal(wetInStockpile.quantity, 2, 'wet transfer quantity should land in its own stockpile stack');

  const afterRemoveWet = advanceTick(afterAddWet, {
    actions: [
      {
        actionId: 'stock-remove-wet-venison',
        actorId: 'player',
        kind: 'camp_stockpile_remove',
        payload: { itemId: 'venison_strip', quantity: 2 },
      },
    ],
  });

  const invVenisonAfterRemove = afterRemoveWet.actors.player.inventory.stacks.filter((entry) => entry.itemId === 'venison_strip');
  assert.equal(invVenisonAfterRemove.length, 2, 'inventory should keep wet and fully dry venison as separate stacks after stockpile removal');
  const invDry = invVenisonAfterRemove.find((entry) => Number(entry.dryness) >= 0.999999);
  const invWet = invVenisonAfterRemove.find((entry) => Number(entry.dryness) < 0.999999);
  assert.ok(invDry, 'inventory should still contain a fully dry venison stack');
  assert.ok(invWet, 'inventory should contain a separate wet venison stack');
  assert.equal(invDry.quantity, 2, 'fully dry inventory stack should remain separate and keep its quantity');
  assert.equal(invWet.quantity, 2, 'wet quantity removed from stockpile should return as its own wet stack');
}

function runCampStockpileCampBoundsValidationTest() {
  const state = createInitialGameState(4220, { width: 30, height: 30 });
  const player = state.actors.player;
  player.inventory.stacks = [{ itemId: 'nuts', quantity: 2 }];
  state.camp.stockpile.stacks = [{ itemId: 'nuts', quantity: 2 }];

  player.x = 0;
  player.y = 0;

  const addOutOfRange = validateAction(state, {
    actorId: 'player',
    kind: 'camp_stockpile_add',
    payload: { itemId: 'nuts', quantity: 1 },
  });
  assert.equal(addOutOfRange.ok, false, 'camp_stockpile_add should reject when actor is outside camp bounds');
  assert.equal(addOutOfRange.code, 'camp_out_of_range', 'camp_stockpile_add should use camp_out_of_range code');

  const removeOutOfRange = validateAction(state, {
    actorId: 'player',
    kind: 'camp_stockpile_remove',
    payload: { itemId: 'nuts', quantity: 1 },
  });
  assert.equal(removeOutOfRange.ok, false, 'camp_stockpile_remove should reject when actor is outside camp bounds');
  assert.equal(removeOutOfRange.code, 'camp_out_of_range', 'camp_stockpile_remove should use camp_out_of_range code');

  player.x = state.camp.anchorX;
  player.y = state.camp.anchorY;

  const addInRange = validateAction(state, {
    actorId: 'player',
    kind: 'camp_stockpile_add',
    payload: { itemId: 'nuts', quantity: 1 },
  });
  assert.equal(addInRange.ok, true, 'camp_stockpile_add should validate when actor is inside camp bounds');

  const removeInRange = validateAction(state, {
    actorId: 'player',
    kind: 'camp_stockpile_remove',
    payload: { itemId: 'nuts', quantity: 1 },
  });
  assert.equal(removeInRange.ok, true, 'camp_stockpile_remove should validate when actor is inside camp bounds');
}

function runInventoryAutoReorderForPickupTest() {
  const state = createInitialGameState(4217, { width: 30, height: 30 });
  const player = state.actors.player;

  player.inventory.gridWidth = 3;
  player.inventory.gridHeight = 2;
  player.inventory.stacks = [
    { itemId: 'small_a', quantity: 1, footprintW: 1, footprintH: 1, slotX: 1, slotY: 0 },
    { itemId: 'small_b', quantity: 1, footprintW: 1, footprintH: 1, slotX: 1, slotY: 1 },
  ];
  state.camp.stockpile.stacks = [
    { itemId: 'large_mat', quantity: 1, footprintW: 2, footprintH: 2 },
  ];

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'take-large',
        actorId: 'player',
        kind: 'camp_stockpile_remove',
        payload: { itemId: 'large_mat', quantity: 1 },
      },
    ],
  });

  const large = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'large_mat');
  assert.ok(large, 'pickup should succeed after automatic inventory reorder');
  assert.equal(large.quantity, 1, 'pickup should move requested quantity into inventory');
  assert.equal(large.footprintW, 2, 'pickup should preserve incoming footprint width');
  assert.equal(large.footprintH, 2, 'pickup should preserve incoming footprint height');
  assert.equal(next.camp.stockpile.stacks.find((entry) => entry.itemId === 'large_mat'), undefined, 'stockpile should be depleted');
  assert.deepEqual(next.worldItemsByTile, {}, 'successful reorder pickup should not drop overflow to world items');
}

function runStockpileWithdrawLeavesRemainderWhenInventoryFullTest() {
  const state = createInitialGameState(4218, { width: 30, height: 30 });
  const player = state.actors.player;
  player.x = state.camp.anchorX;
  player.y = state.camp.anchorY;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile');

  player.inventory.gridWidth = 2;
  player.inventory.gridHeight = 2;
  player.inventory.stacks = [
    { itemId: 'full_blocker', quantity: 1, footprintW: 2, footprintH: 2, slotX: 0, slotY: 0 },
  ];
  state.camp.stockpile.stacks = [
    { itemId: 'too_big_for_space', quantity: 3, footprintW: 2, footprintH: 2 },
  ];

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'no-fit-withdraw',
        actorId: 'player',
        kind: 'camp_stockpile_remove',
        payload: { itemId: 'too_big_for_space', quantity: 3 },
      },
    ],
  });

  const picked = next.actors.player.inventory.stacks.find((entry) => entry.itemId === 'too_big_for_space');
  assert.equal(picked, undefined, 'withdraw should not add item when nothing fits in inventory');
  const stillInPile = next.camp.stockpile.stacks.find((entry) => entry.itemId === 'too_big_for_space');
  assert.ok(stillInPile, 'stockpile should keep the stack when inventory cannot accept it');
  assert.equal(stillInPile.quantity, 3, 'stockpile quantity should be unchanged when withdraw fits nothing');
  assert.deepEqual(next.worldItemsByTile, {}, 'withdraw should not spill excess to ground tiles');
}

function runDailyItemDecayAcrossContainersTest() {
  const state = createInitialGameState(4219, { width: 30, height: 30 });
  // Seed rolls daily weather; cool/cold bands scale decay (GDD §4.5). Mild = 1× so one calendar day is one decay step here.
  state.dailyTemperatureBand = 'mild';

  state.actors.player.inventory.stacks = [
    { itemId: 'player_keep', quantity: 2, decayDaysRemaining: 10 },
    { itemId: 'player_expire', quantity: 1, decayDaysRemaining: 1 },
    { itemId: 'player_stable', quantity: 1 },
  ];
  state.actors.partner.inventory.stacks = [
    { itemId: 'partner_keep', quantity: 1, decayDaysRemaining: 10 },
  ];
  state.camp.stockpile.stacks = [
    { itemId: 'camp_keep', quantity: 4, decayDaysRemaining: 10 },
    { itemId: 'camp_expire', quantity: 1, decayDaysRemaining: 1 },
  ];

  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile');
  const keyA = `${landTile.x},${landTile.y}`;
  const keyBX = landTile.x + 1 < state.width ? landTile.x + 1 : landTile.x - 1;
  const keyB = `${keyBX},${landTile.y}`;
  const initialFertilityAtKeyB = nextTileFertilityFromKey(state, keyB);
  state.worldItemsByTile = {
    [keyA]: [{ itemId: 'world_keep', quantity: 3, decayDaysRemaining: 10 }],
    [keyB]: [{ itemId: 'world_expire', quantity: 1, decayDaysRemaining: 1 }],
  };

  const day1 = advanceDay(state, 1);

  const playerKeep = day1.actors.player.inventory.stacks.find((entry) => entry.itemId === 'player_keep');
  const playerExpire = day1.actors.player.inventory.stacks.find((entry) => entry.itemId === 'player_expire');
  const playerStable = day1.actors.player.inventory.stacks.find((entry) => entry.itemId === 'player_stable');
  const playerRotting = day1.actors.player.inventory.stacks.find((entry) => entry.itemId === 'rotting_organic');
  assert.equal(playerKeep.decayDaysRemaining, 9, 'player inventory decay should decrement by one day at mild temperature');
  assert.equal(playerExpire, undefined, 'expired player inventory stack should convert away from original item');
  assert.ok(playerRotting, 'expired player stack should convert into rotting_organic');
  assert.equal(playerRotting.quantity, 1, 'rotting_organic conversion should collapse quantity to one stack unit');
  assert.equal(playerRotting.decayDaysRemaining, 2, 'rotting_organic should start with fixed decay timer');
  assert.ok(playerStable, 'non-decay stack should remain');

  const partnerKeep = day1.actors.partner.inventory.stacks.find((entry) => entry.itemId === 'partner_keep');
  assert.equal(partnerKeep.decayDaysRemaining, 9, 'partner inventory should also decay one day at mild temperature');

  const campKeep = day1.camp.stockpile.stacks.find((entry) => entry.itemId === 'camp_keep');
  const campExpire = day1.camp.stockpile.stacks.find((entry) => entry.itemId === 'camp_expire');
  const campRotting = day1.camp.stockpile.stacks.find((entry) => entry.itemId === 'rotting_organic');
  assert.equal(campKeep.decayDaysRemaining, 9, 'camp stockpile decay should decrement by one day at mild temperature');
  assert.equal(campExpire, undefined, 'expired camp stockpile stack should convert away from original item');
  assert.ok(campRotting, 'expired camp stockpile stack should convert into rotting_organic');
  assert.equal(campRotting.decayDaysRemaining, 2, 'camp rotting_organic should use fixed decay timer');

  const worldKeep = day1.worldItemsByTile[keyA]?.[0] || null;
  const worldExpireEntry = day1.worldItemsByTile[keyB]?.[0] || null;
  assert.ok(worldKeep, 'world drop stack should remain while decay remains');
  assert.equal(worldKeep.decayDaysRemaining, 9, 'world drop decay should decrement by one day at mild temperature');
  assert.ok(worldExpireEntry, 'expired world stack should convert to rotting_organic instead of immediate removal');
  assert.equal(worldExpireEntry.itemId, 'rotting_organic', 'world expired stack should convert to rotting_organic');
  assert.equal(worldExpireEntry.decayDaysRemaining, 2, 'world rotting_organic should use fixed decay timer');

  const day3 = advanceDay(day1, 2);
  const playerRottingAfter = day3.actors.player.inventory.stacks.find((entry) => entry.itemId === 'rotting_organic');
  const campRottingAfter = day3.camp.stockpile.stacks.find((entry) => entry.itemId === 'rotting_organic');
  const worldRottingAfter = day3.worldItemsByTile[keyB];
  assert.equal(playerRottingAfter, undefined, 'rotting_organic should disappear after fixed timer in inventory');
  assert.equal(campRottingAfter, undefined, 'rotting_organic should disappear after fixed timer in stockpile');
  assert.equal(worldRottingAfter, undefined, 'rotting_organic should disappear after fixed timer on ground');

  const finalFertilityAtKeyB = nextTileFertilityFromKey(day3, keyB);
  assert.ok(
    finalFertilityAtKeyB > initialFertilityAtKeyB,
    'ground rotting_organic expiry should add a small fertility bonus to that tile',
  );
}

function nextTileFertilityFromKey(state, key) {
  const [xRaw, yRaw] = String(key || '').split(',');
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return 0;
  }
  const tile = state.tiles[y * state.width + x];
  return Number(tile?.fertility) || 0;
}

function runDigSquirrelCacheInterruptionTest() {
  const state = createInitialGameState(4212, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile');

  player.x = landTile.x;
  player.y = landTile.y;
  landTile.squirrelCache = {
    cachedSpeciesId: 'juglans_nigra',
    cachedPartName: 'husked_nut',
    cachedSubStageId: 'whole',
    nutContentGrams: 220,
    placementType: 'ground',
    discovered: false,
  };

  const preHarvestValidation = validateAction(state, {
    actorId: 'player',
    kind: 'harvest',
    payload: { x: landTile.x, y: landTile.y, cacheGrams: 100 },
  });
  assert.equal(preHarvestValidation.ok, false, 'cache harvest should not validate before discovery');
  assert.equal(preHarvestValidation.code, 'missing_squirrel_cache', 'undiscovered cache should not be harvestable');

  const digValidation = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(digValidation.ok, true, 'dig on cache tile should validate');
  assert.equal(digValidation.normalizedAction.tickCost, 3, 'dig on undiscovered cache should normalize to 3 ticks');

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'dig-cache',
        actorId: 'player',
        kind: 'dig',
        issuedAtTick: 0,
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const logEntry = next.currentDayActionLog.find((entry) => entry.actionId === 'dig-cache');
  assert.ok(logEntry, 'dig-cache action should be logged');
  assert.equal(logEntry.tickCost, 3, 'dig-cache should consume 3 ticks due to interruption');
  assert.equal(next.dayTick, 3, 'interrupted dig should advance time by 3 ticks');
  assert.equal(
    next.tiles[landTile.y * next.width + landTile.x].squirrelCache.discovered,
    true,
    'digging cache tile should reveal squirrel cache',
  );
  assert.equal(
    next.actors.player.lastDig.interruptedBySquirrelCache,
    true,
    'digging cache tile should record interruption metadata',
  );

  const postHarvestValidation = validateAction(next, {
    actorId: 'player',
    kind: 'harvest',
    payload: { x: landTile.x, y: landTile.y, cacheGrams: 100 },
  });
  assert.equal(postHarvestValidation.ok, true, 'cache harvest should validate after discovery');
}

function runDiggingStickValidationTickReductionTest() {
  const state = createInitialGameState(4226, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one diggable land tile');
  player.x = landTile.x;
  player.y = landTile.y;

  const withoutTool = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(withoutTool.ok, true, 'dig should validate without digging stick');
  assert.equal(withoutTool.normalizedAction.tickCost, 1, 'dig should use base 1 tick without digging stick');

  state.actors.player.inventory.stacks = [{ itemId: 'tool:digging_stick', quantity: 1 }];
  const withTool = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(withTool.ok, true, 'dig should validate with digging stick in inventory');
  assert.equal(withTool.normalizedAction.tickCost, 1, 'digging stick should not reduce dig below 1 tick');
}

function runDiggingStickCacheInterruptionPrecedenceTest() {
  const state = createInitialGameState(4227, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one diggable land tile');

  player.x = landTile.x;
  player.y = landTile.y;
  player.inventory.stacks = [{ itemId: 'tool:digging_stick', quantity: 1 }];
  landTile.squirrelCache = {
    cachedSpeciesId: 'juglans_nigra',
    cachedPartName: 'husked_nut',
    cachedSubStageId: 'whole',
    nutContentGrams: 220,
    placementType: 'ground',
    discovered: false,
  };

  const validation = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(validation.ok, true, 'dig on undiscovered cache tile should validate with digging stick present');
  assert.equal(
    validation.normalizedAction.tickCost,
    2,
    'cache interruption should use 3-tick base discovery cost, then digging stick reduces it to 2 ticks',
  );
}

function runDiggingStickAdvanceTickBudgetConsumptionTest() {
  const noToolState = createInitialGameState(4228, { width: 30, height: 30 });
  const noToolPlayer = noToolState.actors.player;
  const noToolLandTile = noToolState.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(noToolLandTile, 'test requires at least one diggable land tile');
  noToolPlayer.x = noToolLandTile.x;
  noToolPlayer.y = noToolLandTile.y;

  const noToolNext = advanceTick(noToolState, {
    actions: [
      {
        actionId: 'dig-no-tool',
        actorId: 'player',
        kind: 'dig',
        payload: { x: noToolLandTile.x, y: noToolLandTile.y },
      },
    ],
  });

  const noToolLog = noToolNext.currentDayActionLog.find((entry) => entry.actionId === 'dig-no-tool');
  assert.ok(noToolLog, 'dig-no-tool should be logged as applied');
  assert.equal(noToolLog.tickCost, 1, 'dig without tool should consume 1 tick');
  assert.equal(noToolNext.dayTick, 1, 'dig without tool should advance dayTick by 1');
  assert.equal(noToolNext.actors.player.tickBudgetCurrent, 199, 'dig without tool should consume 1 budget tick');

  const withToolState = createInitialGameState(4228, { width: 30, height: 30 });
  const withToolPlayer = withToolState.actors.player;
  const withToolLandTile = withToolState.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(withToolLandTile, 'test requires at least one diggable land tile in tool state');
  withToolPlayer.x = withToolLandTile.x;
  withToolPlayer.y = withToolLandTile.y;
  withToolPlayer.inventory.stacks = [{ itemId: 'tool:digging_stick', quantity: 1 }];

  const withToolNext = advanceTick(withToolState, {
    actions: [
      {
        actionId: 'dig-with-tool',
        actorId: 'player',
        kind: 'dig',
        payload: { x: withToolLandTile.x, y: withToolLandTile.y },
      },
    ],
  });

  const withToolLog = withToolNext.currentDayActionLog.find((entry) => entry.actionId === 'dig-with-tool');
  assert.ok(withToolLog, 'dig-with-tool should be logged as applied');
  assert.equal(withToolLog.tickCost, 1, 'dig with digging stick should consume 1 tick');
  assert.equal(withToolNext.dayTick, 1, 'dig with digging stick should advance dayTick by 1');
  assert.equal(withToolNext.actors.player.tickBudgetCurrent, 199, 'dig with digging stick should consume 1 budget tick');
}

function runShovelValidationTickReductionTest() {
  const state = createInitialGameState(4229, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one diggable land tile');

  player.x = landTile.x;
  player.y = landTile.y;
  player.inventory.stacks = [{ itemId: 'tool:shovel', quantity: 1 }];

  const validation = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { x: landTile.x, y: landTile.y },
  });

  assert.equal(validation.ok, true, 'dig should validate with shovel in inventory');
  assert.equal(validation.normalizedAction.tickCost, 1, 'shovel should not reduce dig below 1 tick');
}

function runShovelPrecedenceOverDiggingStickTest() {
  const state = createInitialGameState(4230, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one diggable land tile');

  player.x = landTile.x;
  player.y = landTile.y;
  player.inventory.stacks = [
    { itemId: 'tool:digging_stick', quantity: 1 },
    { itemId: 'tool:shovel', quantity: 1 },
  ];

  const validation = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { x: landTile.x, y: landTile.y },
  });

  assert.equal(validation.ok, true, 'dig should validate when carrying both digging tools');
  assert.equal(validation.normalizedAction.tickCost, 1, 'dig should remain clamped to 1 tick when carrying both digging tools');
}

function runShovelCacheDiscoveryTickNormalizationTest() {
  const state = createInitialGameState(4231, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one diggable land tile');

  player.x = landTile.x;
  player.y = landTile.y;
  player.inventory.stacks = [{ itemId: 'tool:shovel', quantity: 1 }];
  landTile.squirrelCache = {
    cachedSpeciesId: 'juglans_nigra',
    cachedPartName: 'husked_nut',
    cachedSubStageId: 'whole',
    nutContentGrams: 220,
    placementType: 'ground',
    discovered: false,
  };

  const validation = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { x: landTile.x, y: landTile.y },
  });

  assert.equal(validation.ok, true, 'dig on undiscovered cache tile should validate with shovel present');
  assert.equal(validation.normalizedAction.tickCost, 2, 'shovel should apply to 3-tick cache discovery base and normalize to 2 ticks');
}

function runShovelAdvanceTickBudgetConsumptionTest() {
  const state = createInitialGameState(4232, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one diggable land tile');

  player.x = landTile.x;
  player.y = landTile.y;
  player.inventory.stacks = [{ itemId: 'tool:shovel', quantity: 1 }];

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'dig-with-shovel',
        actorId: 'player',
        kind: 'dig',
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const logEntry = next.currentDayActionLog.find((entry) => entry.actionId === 'dig-with-shovel');
  assert.ok(logEntry, 'dig-with-shovel should be logged as applied');
  assert.equal(logEntry.tickCost, 1, 'dig with shovel should consume 1 tick');
  assert.equal(next.dayTick, 1, 'dig with shovel should advance dayTick by 1');
  assert.equal(next.actors.player.tickBudgetCurrent, 199, 'dig with shovel should consume 1 budget tick');
}

function runDigUndergroundPlantPartFlowTest() {
  const state = createInitialGameState(4233, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one diggable land tile');

  player.x = landTile.x;
  player.y = landTile.y;

  const plantId = 'test-underground-root';
  state.plants[plantId] = {
    id: plantId,
    speciesId: 'daucus_carota',
    x: landTile.x,
    y: landTile.y,
    ageDays: 8,
    stageName: 'first_year_dormant',
    alive: true,
    vitality: 1,
    source: 'test',
    activeSubStages: [
      {
        partName: 'root',
        subStageId: 'first_year',
        regrowthCountdown: null,
        harvestsThisSeason: 0,
      },
    ],
  };
  landTile.plantIds = [plantId];

  const digNext = advanceTick(state, {
    actions: [0, 1, 2, 3, 4].map((i) => ({
      actionId: `dig-underground-root-${i}`,
      actorId: 'player',
      kind: 'dig',
      payload: { x: landTile.x, y: landTile.y },
    })),
  });

  const digLogs = digNext.currentDayActionLog.filter((entry) => String(entry.actionId || '').startsWith('dig-underground-root'));
  assert.equal(digLogs.length, 5, 'five dig actions should run for carrot root discovery threshold');
  assert.ok(digLogs.every((e) => e.status === 'applied'), 'each dig should apply on tile containing underground plant part');
  const postDigTile = digNext.tiles[landTile.y * digNext.width + landTile.x];
  assert.equal(postDigTile.disturbed, true, 'dig should disturb tile before underground-part harvest');
  const postDigPlant = digNext.plants[plantId] || null;
  assert.ok(postDigPlant, 'plant should remain after digs');
  const rootEntry = postDigPlant.activeSubStages.find((s) => s.partName === 'root' && s.subStageId === 'first_year');
  assert.ok(rootEntry, 'root sub-stage should remain active');
  assert.ok(
    Number(rootEntry.digRevealTicksApplied) >= 5,
    'dig should accumulate enough tick progress to reveal underground root',
  );

  const harvestNext = advanceTick(digNext, {
    actions: [
      {
        actionId: 'harvest-underground-root',
        actorId: 'player',
        kind: 'harvest',
        payload: {
          plantId,
          partName: 'root',
          subStageId: 'first_year',
          actions: 1,
        },
      },
    ],
  });

  const harvestLog = harvestNext.currentDayActionLog.find((entry) => entry.actionId === 'harvest-underground-root');
  assert.ok(harvestLog && harvestLog.status === 'applied', 'harvest should apply for underground root after digging');
  const rootStack = (harvestNext.actors.player.inventory?.stacks || []).find((entry) => entry.itemId === 'daucus_carota:root:first_year');
  assert.ok(rootStack, 'harvesting underground root should add root item to inventory');
  assert.equal(rootStack.quantity, 1, 'harvesting underground root should add one unit for one harvest action');
  // ageDays 8, harvest_yield_full_age_days 20, harvest_unit_weight_scales_with_age: 30g × (8/20) = 12g
  assert.ok(
    Math.abs(Number(rootStack.unitWeightKg) - 0.012) < 1e-9,
    'scaled carrot root unit weight should match age × catalog unit_weight_g',
  );
}

function runCarrotHarvestScaledUnitWeightTest() {
  const landTile = (state) => state.tiles.find((tile) => !tile.waterType && !tile.rockType);

  const runHarvestAtAge = (seed, ageDays) => {
    const state = createInitialGameState(seed, { width: 20, height: 20 });
    const tile = landTile(state);
    assert.ok(tile, 'test requires a land tile');
    const player = state.actors.player;
    player.x = tile.x;
    player.y = tile.y;
    const plantId = 'test-carrot-weight';
    state.plants[plantId] = {
      id: plantId,
      speciesId: 'daucus_carota',
      x: tile.x,
      y: tile.y,
      ageDays,
      stageName: 'first_year_vegetative',
      alive: true,
      vitality: 1,
      source: 'test',
      activeSubStages: [
        {
          partName: 'root',
          subStageId: 'first_year',
          regrowthCountdown: null,
          harvestsThisSeason: 0,
          digRevealTicksApplied: 5,
        },
      ],
    };
    tile.plantIds = [plantId];
    return advanceTick(state, {
      actions: [
        {
          actionId: `harvest-carrot-root-${ageDays}`,
          actorId: 'player',
          kind: 'harvest',
          payload: {
            plantId,
            partName: 'root',
            subStageId: 'first_year',
            actions: 1,
          },
        },
      ],
    });
  };

  const young = runHarvestAtAge(4240, 2);
  const youngStack = young.actors.player.inventory.stacks.find((s) => s.itemId === 'daucus_carota:root:first_year');
  assert.ok(youngStack, 'young carrot harvest should produce root stack');
  assert.ok(
    Math.abs(Number(youngStack.unitWeightKg) - 0.003) < 1e-9,
    'age 2 vs ref 20 hits min scale 0.1 → 3g per unit',
  );

  const mature = runHarvestAtAge(4241, 25);
  const matureStack = mature.actors.player.inventory.stacks.find((s) => s.itemId === 'daucus_carota:root:first_year');
  assert.ok(matureStack, 'mature carrot harvest should produce root stack');
  assert.ok(
    Math.abs(Number(matureStack.unitWeightKg) - 0.03) < 1e-9,
    'age ≥ ref days should yield full 30g catalog unit weight',
  );
}

function runHoeValidationAndTickCostTest() {
  const state = createInitialGameState(4234, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one hoe-eligible tile');

  player.x = landTile.x;
  player.y = landTile.y;
  if (!Array.isArray(player.inventory?.stacks)) {
    player.inventory.stacks = [];
  }
  player.inventory.stacks.push({ itemId: 'tool:hoe', quantity: 1 });
  player.tickBudgetCurrent = Math.max(1, Math.floor(Number(player.tickBudgetCurrent) || 1));
  if (!state.techUnlocks || typeof state.techUnlocks !== 'object') {
    state.techUnlocks = {};
  }
  state.techUnlocks.unlock_tool_hoe = true;

  assert.equal(getActionTickCost('hoe'), 2, 'hoe default action tick cost should be 2');

  const validation = validateAction(state, {
    actorId: 'player',
    kind: 'hoe',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(validation.ok, true, 'hoe should validate on land tile');
  assert.equal(validation.normalizedAction.tickCost, 2, 'hoe validation should normalize tick cost to 2 by default');

  const preview = previewAction(state, {
    actorId: 'player',
    kind: 'hoe',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(preview.ok, true, 'hoe preview should validate on land tile');
  assert.equal(preview.tickCost, 2, 'hoe preview should surface 2-tick default');
}

function runHoeBlockedTileRulesTest() {
  const rockState = createInitialGameState(4235, { width: 30, height: 30 });
  const rockPlayer = rockState.actors.player;
  const rockTile = rockState.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(rockTile, 'test requires at least one mutable tile for rock case');

  rockTile.rockType = 'granite';
  rockPlayer.x = rockTile.x;
  rockPlayer.y = rockTile.y;

  const rockValidation = validateAction(rockState, {
    actorId: 'player',
    kind: 'hoe',
    payload: { x: rockTile.x, y: rockTile.y },
  });
  assert.equal(rockValidation.ok, false, 'hoe should reject rock tile');
  assert.equal(rockValidation.code, 'hoe_blocked_tile', 'hoe on rock should return hoe_blocked_tile');

  const deepWaterState = createInitialGameState(4236, { width: 30, height: 30 });
  const deepWaterPlayer = deepWaterState.actors.player;
  const deepWaterTile = deepWaterState.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(deepWaterTile, 'test requires at least one mutable tile for deep-water case');

  deepWaterTile.waterType = 'river';
  deepWaterTile.waterDepth = 'deep';
  deepWaterPlayer.x = deepWaterTile.x;
  deepWaterPlayer.y = deepWaterTile.y;

  const deepWaterValidation = validateAction(deepWaterState, {
    actorId: 'player',
    kind: 'hoe',
    payload: { x: deepWaterTile.x, y: deepWaterTile.y },
  });
  assert.equal(deepWaterValidation.ok, false, 'hoe should reject deep-water tile');
  assert.equal(deepWaterValidation.code, 'hoe_blocked_tile', 'hoe on deep water should return hoe_blocked_tile');
}

function runHoeRuntimeEffectsTest() {
  const state = createInitialGameState(4237, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one hoe-eligible tile');

  landTile.disturbed = false;
  landTile.dormantSeeds = {
    daucus_carota: { ageDays: 7 },
    allium_tricoccum: { ageDays: 2 },
  };
  player.x = landTile.x;
  player.y = landTile.y;
  if (!Array.isArray(player.inventory?.stacks)) {
    player.inventory.stacks = [];
  }
  player.inventory.stacks.push({ itemId: 'tool:hoe', quantity: 1 });
  if (!state.techUnlocks || typeof state.techUnlocks !== 'object') {
    state.techUnlocks = {};
  }
  state.techUnlocks.unlock_tool_hoe = true;

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'hoe-effects',
        actorId: 'player',
        kind: 'hoe',
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const logEntry = next.currentDayActionLog.find((entry) => entry.actionId === 'hoe-effects');
  assert.ok(logEntry && logEntry.status === 'applied', 'hoe action should apply');

  const postHoeTile = next.tiles[landTile.y * next.width + landTile.x];
  assert.equal(postHoeTile.disturbed, true, 'hoe should disturb target tile');
  assert.deepEqual(postHoeTile.dormantSeeds, {}, 'hoe should clear dormant seed pool on target tile');
}

function runHoeAdvanceTickBudgetConsumptionTest() {
  const state = createInitialGameState(4238, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one hoe-eligible tile');

  player.x = landTile.x;
  player.y = landTile.y;
  if (!Array.isArray(player.inventory?.stacks)) {
    player.inventory.stacks = [];
  }
  player.inventory.stacks.push({ itemId: 'tool:hoe', quantity: 1 });
  if (!state.techUnlocks || typeof state.techUnlocks !== 'object') {
    state.techUnlocks = {};
  }
  state.techUnlocks.unlock_tool_hoe = true;

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'hoe-budget',
        actorId: 'player',
        kind: 'hoe',
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const logEntry = next.currentDayActionLog.find((entry) => entry.actionId === 'hoe-budget');
  assert.ok(logEntry, 'hoe-budget should be logged as applied');
  assert.equal(logEntry.tickCost, 2, 'hoe should consume 2 ticks');
  assert.equal(next.dayTick, 2, 'hoe should advance dayTick by 2');
  assert.equal(next.actors.player.tickBudgetCurrent, 198, 'hoe should consume 2 budget ticks');
}

function runDigShallowWaterAllowedTest() {
  const state = createInitialGameState(4213, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one mutable tile');

  landTile.waterType = 'river';
  landTile.waterDepth = 'shallow';
  landTile.rockType = null;
  player.x = landTile.x;
  player.y = landTile.y;

  const validation = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { x: landTile.x, y: landTile.y },
  });
  assert.equal(validation.ok, true, 'dig should be allowed on shallow water tiles');

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'dig-shallow',
        actorId: 'player',
        kind: 'dig',
        payload: { x: landTile.x, y: landTile.y },
      },
    ],
  });

  const entry = next.currentDayActionLog.find((log) => log.actionId === 'dig-shallow');
  assert.ok(entry && entry.status === 'applied', 'dig in shallow water should apply');
}

function runDiscoveredSquirrelCacheHarvestTest() {
  const state = createInitialGameState(4214, { width: 30, height: 30 });
  const player = state.actors.player;
  const landTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(landTile, 'test requires at least one land tile');

  player.x = landTile.x;
  player.y = landTile.y;
  landTile.squirrelCache = {
    cachedSpeciesId: 'juglans_nigra',
    cachedPartName: 'husked_nut',
    cachedSubStageId: 'whole',
    nutContentGrams: 180,
    placementType: 'ground',
    discovered: true,
  };

  const first = advanceTick(state, {
    actions: [
      {
        actionId: 'harvest-cache-1',
        actorId: 'player',
        kind: 'harvest',
        payload: { x: landTile.x, y: landTile.y, cacheGrams: 100 },
      },
    ],
  });

  const stackId = 'juglans_nigra:husked_nut:whole';
  const firstStack = first.actors.player.inventory.stacks.find((entry) => entry.itemId === stackId);
  assert.ok(firstStack, 'cache harvest should add plant-part inventory stack');
  assert.equal(firstStack.quantity, 7, 'cache harvest should convert cached grams to whole plant-part units');
  assert.equal(
    first.tiles[landTile.y * first.width + landTile.x].squirrelCache,
    null,
    'cache should be removed after full harvest',
  );
}

function runAdvanceTickInputImmutabilityTest() {
  const state = createInitialGameState(4202, { width: 40, height: 40 });
  const sourcePlayer = state.actors.player;
  const sourceDayTick = state.dayTick;

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'immu-move',
        actorId: 'player',
        kind: 'move',
        issuedAtTick: 0,
        payload: { dx: 1, dy: 0 },
      },
    ],
  });

  assert.ok(next !== state, 'advanceTick should return a new state object');
  assert.equal(state.dayTick, sourceDayTick, 'advanceTick should not mutate source dayTick');
  assert.equal(state.actors.player.x, sourcePlayer.x, 'advanceTick should not mutate source actor x');
  assert.equal(state.actors.player.y, sourcePlayer.y, 'advanceTick should not mutate source actor y');
  assert.equal(
    JSON.stringify(state.currentDayActionLog),
    JSON.stringify([]),
    'advanceTick should not mutate source action log',
  );
}

function runAdvanceTickInvalidActionRejectionTest() {
  const state = createInitialGameState(4203, { width: 30, height: 30 });

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'bad-move',
        actorId: 'player',
        kind: 'move',
        issuedAtTick: 0,
        payload: { dx: 9999, dy: 0 },
      },
    ],
  });

  const rejected = next.currentDayActionLog.find((entry) => entry.actionId === 'bad-move');
  assert.ok(rejected, 'invalid action should be logged as rejected');
  assert.equal(rejected.status, 'rejected', 'invalid action should have rejected status');
  assert.equal(rejected.code, 'move_out_of_bounds', 'invalid move should return move_out_of_bounds code');
  assert.equal(next.dayTick, 0, 'rejected action should not consume ticks');

  const directValidation = validateAction(state, {
    actorId: 'player',
    kind: 'move',
    payload: { dx: 9999, dy: 0 },
  });
  assert.equal(directValidation.ok, false, 'validateAction should reject out-of-bounds move');
}

function runGetAllActionsSmokeTest() {
  const state = createInitialGameState(4204, { width: 30, height: 30 });
  const playerActions = getAllActions(state, 'player');
  const moveEntry = playerActions.find((entry) => entry.kind === 'move');

  assert.ok(Array.isArray(playerActions), 'getAllActions should return array');
  assert.ok(moveEntry, 'getAllActions should include move action');
  assert.equal(moveEntry.available, true, 'move action should be available for living player');

  const missingActions = getAllActions(state, 'missing_actor');
  assert.ok(
    missingActions.every((entry) => entry.available === false),
    'missing actor should report all actions as unavailable',
  );
}

function runAdvanceTickBudgetGateTest() {
  const state = createInitialGameState(4205, { width: 30, height: 30 });
  const startX = state.actors.player.x;
  const startY = state.actors.player.y;
  state.actors.player.tickBudgetCurrent = 0;

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'zero-budget-move',
        actorId: 'player',
        kind: 'move',
        issuedAtTick: 0,
        payload: { dx: 1, dy: 0 },
      },
    ],
  });

  const applied = next.currentDayActionLog.find((entry) => entry.actionId === 'zero-budget-move');
  assert.ok(applied, 'zero-budget move should be logged');
  assert.equal(applied.status, 'applied', 'zero-budget move should apply via tick overdraft');
  assert.equal(next.dayTick, 1, 'overdraft move should advance time');
  assert.equal(next.actors.player.tickBudgetCurrent, -1, 'move at zero budget should spend into overdraft');
  assert.equal(next.actors.player.x, startX + 1, 'overdraft move should change x');

  const listed = getAllActions(next, 'player');
  const moveEntry = listed.find((entry) => entry.kind === 'move');
  assert.equal(moveEntry.available, true, 'move should stay available while under the overdraft cap');

  const maxOd = createInitialGameState(4205, { width: 30, height: 30 });
  maxOd.actors.player.tickBudgetCurrent = -40;
  const blocked = validateAction(maxOd, {
    actionId: 'max-od-move',
    actorId: 'player',
    kind: 'move',
    payload: { dx: 1, dy: 0 },
  });
  assert.equal(blocked.ok, false, 'validateAction should reject move that would exceed max overdraft');
  assert.equal(blocked.code, 'no_tick_budget', 'max overdraft should report no_tick_budget');
}

function runAdvanceTickFullCostOverdraftTest() {
  const state = createInitialGameState(4206, { width: 30, height: 30 });
  state.actors.player.tickBudgetCurrent = 3;

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'overdraft-move',
        actorId: 'player',
        kind: 'move',
        issuedAtTick: 0,
        payload: { dx: 1, dy: 0, tickCost: 5 },
      },
    ],
  });

  const applied = next.currentDayActionLog.find((entry) => entry.actionId === 'overdraft-move');
  assert.ok(applied, 'high-cost action should be logged as applied when actor can start action');
  assert.equal(applied.status, 'applied', 'high-cost action should apply');
  assert.equal(applied.tickCost, 5, 'high-cost action should consume full declared tick cost');
  assert.equal(next.dayTick, 5, 'state should advance by full action tick cost');
  assert.equal(next.actors.player.tickBudgetCurrent, -2, 'actor should enter negative current budget after overdraft');
  assert.equal(next.actors.player.overdraftTicks, 2, 'overdraftTicks should reflect negative budget magnitude');
}

function runActionTickCostPreviewTest() {
  const state = createInitialGameState(4207, { width: 30, height: 30 });

  assert.equal(getActionTickCost('dig'), 1, 'getActionTickCost should return catalog default for dig');
  assert.equal(
    getActionTickCost('move', { tickCost: 7 }),
    7,
    'getActionTickCost should respect explicit payload tickCost override',
  );

  const validPreview = previewAction(state, {
    actorId: 'player',
    kind: 'move',
    payload: { dx: 1, dy: 0, tickCost: 5 },
  });
  assert.equal(validPreview.ok, true, 'previewAction should pass for valid action envelope');
  assert.equal(validPreview.tickCost, 5, 'previewAction should surface overridden tick cost for valid actions');

  const invalidPreview = previewAction(state, {
    actorId: 'missing_actor',
    kind: 'move',
    payload: { dx: 1, dy: 0, tickCost: 6 },
  });
  assert.equal(invalidPreview.ok, false, 'previewAction should fail with normal validation for invalid actor');
  assert.equal(invalidPreview.code, 'missing_actor', 'previewAction should preserve validation code');
  assert.equal(
    invalidPreview.tickCost,
    6,
    'previewAction should still surface requested tick cost for invalid actions',
  );
}

function runWaterFloodFillPondClassificationTest() {
  const classifyWater = waterGenTestables.classifyWater;
  assert.equal(typeof classifyWater, 'function', 'waterGen classifyWater should be exposed for regression tests');

  const width = 12;
  const height = 12;
  const area = width * height;

  const compactPondMask = new Uint8Array(area);
  for (let y = 3; y <= 7; y += 1) {
    for (let x = 3; x <= 7; x += 1) {
      compactPondMask[y * width + x] = 1;
    }
  }

  const compactResult = classifyWater(compactPondMask, width, height, 10, 3);
  const compactCenter = 5 * width + 5;
  assert.equal(
    compactResult.still[compactCenter],
    1,
    'compact 5x5 pond center should classify as still when farthest distance after 10 searched tiles is <= 3',
  );
  assert.equal(compactResult.moving[compactCenter], 0, 'compact pond center should not classify as moving');

  const narrowChannelMask = new Uint8Array(area);
  for (let x = 1; x <= 10; x += 1) {
    narrowChannelMask[6 * width + x] = 1;
  }

  const channelResult = classifyWater(narrowChannelMask, width, height, 10, 3);
  const channelStart = 6 * width + 1;
  assert.equal(
    channelResult.moving[channelStart],
    1,
    'narrow channel tile should classify as moving when farthest distance after 10 searched tiles exceeds 3',
  );
  assert.equal(channelResult.still[channelStart], 0, 'narrow channel tile should not classify as still');
}

function runGroundFungusZoneGenerationGateAndPermanenceTest() {
  const state = createInitialGameState(10777, { width: 40, height: 40 });
  assert.equal(
    canGenerateMushroomZones(state),
    false,
    'ground fungus zones should be gated until ecosystem stabilization threshold is reached',
  );

  const stabilized = getStabilizedState(10777, { width: 40, height: 40 }, 400);
  assert.equal(
    canGenerateMushroomZones(stabilized),
    true,
    'ground fungus zones should become available after stabilization horizon',
  );

  const withZones = generateGroundFungusZones(stabilized);
  assert.equal(withZones.groundFungusZonesGenerated, true, 'zone generation should set generated flag');
  assert.ok(withZones.runGroundFungusPool.length > 0, 'zone generation should select non-empty run pool');

  const zoneTiles = withZones.tiles.filter((tile) => tile.groundFungusZone);
  assert.ok(zoneTiles.length > 0, 'zone generation should assign ground fungus zone tiles');

  const zoneSignature = zoneTiles
    .map((tile) => `${tile.x},${tile.y}:${tile.groundFungusZone.speciesId}:${tile.groundFungusZone.zoneId}`)
    .sort()
    .join('|');

  const afterYears = advanceDay(withZones, 120);
  const afterSignature = afterYears.tiles
    .filter((tile) => tile.groundFungusZone)
    .map((tile) => `${tile.x},${tile.y}:${tile.groundFungusZone.speciesId}:${tile.groundFungusZone.zoneId}`)
    .sort()
    .join('|');

  assert.equal(
    afterSignature,
    zoneSignature,
    'ground fungus zone placement should remain permanent across advanceDay/multi-year simulation',
  );

  const secondTrigger = generateGroundFungusZones(withZones);
  assert.equal(
    secondTrigger,
    withZones,
    'zone generation trigger should be one-time and return existing state when already generated',
  );
}

function runGroundFungusFruitingBlockedReassignmentTest() {
  const state = createInitialGameState(20777, { width: 20, height: 20 });
  state.dayOfYear = 5;
  state.year = 1;
  state.totalDaysSimulated = 400;
  state.groundFungusZonesGenerated = true;
  state.runGroundFungusPool = ['test_mushroom'];
  state.plants = {};
  state.nextPlantNumericId = 2;

  for (const tile of state.tiles) {
    tile.plantIds = [];
    tile.groundFungusZone = null;
    tile.waterType = null;
    tile.rockType = null;
  }

  const occupiedTile = state.tiles[8 * state.width + 8];
  const fallbackTile = state.tiles[8 * state.width + 9];

  const sharedZoneData = {
    type: 'ground_fungus_zone',
    speciesId: 'test_mushroom',
    zoneId: 'test_mushroom:1',
    annualFruitChance: 1,
    fruitingWindows: [{ startDay: 5, endDay: 10 }],
    perTileYieldRange: [10, 10],
    yieldCurrentGrams: 0,
    rolledYearByWindow: {},
  };

  occupiedTile.groundFungusZone = { ...sharedZoneData, annualFruitChance: 1 };
  fallbackTile.groundFungusZone = { ...sharedZoneData, annualFruitChance: 0 };

  state.plants.blocker = {
    id: 'blocker',
    speciesId: 'daucus_carota',
    age: 20,
    x: occupiedTile.x,
    y: occupiedTile.y,
    stageName: 'first_year_vegetative',
    alive: true,
    vitality: 1,
    activeSubStages: [],
    source: 'test',
  };
  occupiedTile.plantIds = ['blocker'];

  const fruited = advanceDay(state, 1);
  const fruitedOccupied = fruited.tiles[occupiedTile.y * fruited.width + occupiedTile.x];
  const fruitedFallback = fruited.tiles[fallbackTile.y * fruited.width + fallbackTile.x];

  assert.equal(
    fruitedOccupied.groundFungusZone.yieldCurrentGrams,
    0,
    'occupied zone tile should not retain mushroom yield when blocked by plant occupancy',
  );
  assert.ok(
    fruitedFallback.groundFungusZone.yieldCurrentGrams > 0,
    'blocked successful fruit roll should be reassigned to another unoccupied tile in same zone',
  );

  const afterWindow = advanceDay(fruited, 6);
  const closedWindowTile = afterWindow.tiles[fallbackTile.y * afterWindow.width + fallbackTile.x];
  assert.equal(
    closedWindowTile.groundFungusZone.yieldCurrentGrams,
    0,
    'ground fungus yield should reset to zero when fruiting window closes',
  );
}

function runGroundFungusSnapshotRoundTripTest() {
  const stabilized = getStabilizedState(10777, { width: 40, height: 40 }, 400);
  const withZones = generateGroundFungusZones(stabilized);
  assert.equal(withZones.groundFungusZonesGenerated, true, 'test setup requires generated zones');

  const payload = serializeGameState(withZones);
  const loaded = deserializeGameState(payload);
  assert.equal(
    loaded.groundFungusZonesGenerated,
    true,
    'snapshot round-trip should preserve generated-zone state flag',
  );

  const originalZones = withZones.tiles
    .filter((tile) => tile.groundFungusZone)
    .map((tile) => `${tile.x},${tile.y}:${tile.groundFungusZone.speciesId}:${tile.groundFungusZone.zoneId}`)
    .sort()
    .join('|');
  const loadedZones = loaded.tiles
    .filter((tile) => tile.groundFungusZone)
    .map((tile) => `${tile.x},${tile.y}:${tile.groundFungusZone.speciesId}:${tile.groundFungusZone.zoneId}`)
    .sort()
    .join('|');

  assert.equal(loadedZones, originalZones, 'snapshot round-trip should preserve zone tile assignments');
}

function lifeStageSize(species, stageName) {
  const stage = species?.lifeStages?.find((candidate) => candidate.stage === stageName);
  if (!Number.isFinite(stage?.size)) {
    return 1;
  }
  return Math.max(1, Math.round(stage.size));
}

function dayForSeason(seasonName) {
  for (let day = 1; day <= 40; day += 1) {
    if (getSeason(day) === seasonName) {
      return day;
    }
  }
  return 1;
}

function runBeehiveGenerationGatePlacementAndSeasonalBehaviorTest() {
  const state = createInitialGameState(28711, { width: 50, height: 50 });
  assert.equal(
    canGenerateBeehives(state),
    false,
    'beehive generation should be gated until ecosystem stabilization threshold is reached',
  );

  const stabilized = getStabilizedState(28711, { width: 50, height: 50 }, 400);
  assert.equal(
    canGenerateBeehives(stabilized),
    true,
    'beehive generation should unlock after stabilization horizon',
  );

  const withBeehives = generateBeehives(stabilized);
  assert.equal(withBeehives.beehivesGenerated, true, 'beehive generation should set generated flag');

  const beehiveTiles = withBeehives.tiles.filter((tile) => tile.beehive);
  assert.ok(beehiveTiles.length > 0, 'beehive generation should assign at least one beehive tile');

  for (const tile of beehiveTiles) {
    assert.equal(Boolean(tile.waterType), false, 'beehives should never be placed on water tiles');
    assert.equal(Boolean(tile.deadLog), false, 'beehives should not be placed on dead-log tiles');
    assert.ok(tile.plantIds.length > 0, 'beehives should be hosted by a living tree tile with a plant occupant');

    const hostPlant = withBeehives.plants[tile.plantIds[0]];
    assert.ok(hostPlant?.alive, 'beehive host plant should be alive');

    const species = PLANT_BY_ID[hostPlant.speciesId];
    assert.equal(species?.longevity, 'perennial', 'beehive host should be perennial tree species');
    assert.ok(
      lifeStageSize(species, hostPlant.stageName) >= 8,
      'beehive host should be mature-sized perennial tree',
    );
  }

  const winterCandidate = {
    ...withBeehives,
    dayOfYear: dayForSeason('winter'),
  };
  const winterState = advanceDay(winterCandidate, 1);
  const winterBeehives = winterState.tiles.filter((tile) => tile.beehive);
  assert.ok(winterBeehives.length > 0, 'winter behavior check requires beehive tiles');
  assert.ok(
    winterBeehives.every((tile) => tile.beehive.active === false),
    'beehives should be inactive in winter',
  );
  assert.ok(
    winterBeehives.every((tile) => Number(tile.beehive.yieldCurrentHoneyGrams) === 0
      && Number(tile.beehive.yieldCurrentLarvaeGrams) === 0
      && Number(tile.beehive.yieldCurrentBeeswaxGrams) === 0),
    'winter beehive yields should be depleted to zero',
  );

  const summerCandidate = {
    ...winterState,
    dayOfYear: dayForSeason('summer'),
  };
  const summerState = advanceDay(summerCandidate, 1);
  const summerBeehives = summerState.tiles.filter((tile) => tile.beehive);
  assert.ok(
    summerBeehives.some((tile) => tile.beehive.active === true),
    'beehives should become active again during non-winter seasons',
  );
  assert.ok(
    summerBeehives.some((tile) => Number(tile.beehive.yieldCurrentHoneyGrams) > 0),
    'active-season beehives should replenish honey yield',
  );

  const secondTrigger = generateBeehives(withBeehives);
  assert.equal(
    secondTrigger,
    withBeehives,
    'beehive generation should be one-time and return same state when already generated',
  );
}

function runSquirrelCacheGenerationPlacementAndYearlyRefillTest() {
  const state = createInitialGameState(28711, { width: 50, height: 50 });
  assert.equal(
    canGenerateSquirrelCaches(state),
    false,
    'squirrel cache generation should be gated until ecosystem stabilization threshold is reached',
  );

  const stabilized = getStabilizedState(28711, { width: 50, height: 50 }, 400);
  assert.equal(
    canGenerateSquirrelCaches(stabilized),
    true,
    'squirrel cache generation should unlock after stabilization horizon',
  );

  const withCaches = generateSquirrelCaches(stabilized);
  assert.equal(withCaches.squirrelCachesGenerated, true, 'squirrel cache generation should set generated flag');

  const cacheTiles = withCaches.tiles.filter((tile) => tile.squirrelCache);
  assert.ok(cacheTiles.length > 0, 'squirrel cache generation should assign at least one cache tile');

  const groundCaches = cacheTiles.filter((tile) => tile.squirrelCache.placementType === 'ground');
  const deadTreeCaches = cacheTiles.filter((tile) => tile.squirrelCache.placementType === 'dead_tree');
  assert.ok(groundCaches.length >= deadTreeCaches.length, 'cache generation should bias toward ground placements');
  assert.ok(groundCaches.length > 0, 'cache generation should place at least one ground cache');

  for (const tile of groundCaches) {
    assert.equal(Boolean(tile.waterType), false, 'ground caches should not be placed on water');
    assert.equal(Boolean(tile.deadLog), false, 'ground caches should not be on dead-log tiles');
  }
  for (const tile of deadTreeCaches) {
    assert.ok(tile.deadLog, 'dead-tree caches should only be placed on dead-log tiles');
  }

  for (const tile of cacheTiles) {
    assert.ok(Number(tile.squirrelCache.nutContentGrams) >= 0, 'cache nut grams should be normalized non-negative');
    assert.equal(typeof tile.squirrelCache.cachedSpeciesId, 'string', 'cache should store cached species id');
    assert.equal(typeof tile.squirrelCache.cachedPartName, 'string', 'cache should store cached part name');
    assert.equal(typeof tile.squirrelCache.cachedSubStageId, 'string', 'cache should store cached sub-stage id');
    const species = PLANT_BY_ID[tile.squirrelCache.cachedSpeciesId];
    const part = (species?.parts || []).find((entry) => entry.name === tile.squirrelCache.cachedPartName);
    const subStage = (part?.subStages || []).find((entry) => entry.id === tile.squirrelCache.cachedSubStageId);
    assert.equal(
      subStage?.can_squirrel_cache,
      true,
      'cache payload should reference a part sub-stage explicitly marked can_squirrel_cache',
    );
    assert.equal(
      withCaches.runSquirrelCacheNutPool.includes(tile.squirrelCache.cachedSpeciesId),
      true,
      'cache nut species should come from run-level squirrel nut pool',
    );
  }

  const initialCacheCount = cacheTiles.length;
  for (const tile of cacheTiles) {
    tile.squirrelCache.discovered = true;
    tile.squirrelCache.cachedSpeciesId = 'marker_species';
    tile.squirrelCache.cachedPartName = 'marker_part';
    tile.squirrelCache.cachedSubStageId = 'marker_stage';
    tile.squirrelCache.nutContentGrams = 1;
  }

  const afterYear = advanceDay(withCaches, 40);
  const afterYearCaches = afterYear.tiles.filter((tile) => tile.squirrelCache);
  assert.ok(afterYearCaches.length > 0, 'yearly cycle should regenerate squirrel caches');
  assert.ok(
    afterYearCaches.every((tile) => tile.squirrelCache.discovered === false),
    'yearly regeneration should reset discovered state for newly generated caches',
  );
  assert.ok(
    afterYearCaches.every((tile) => tile.squirrelCache.cachedSpeciesId !== 'marker_species'),
    'yearly regeneration should remove old cache objects instead of mutating in-place forever',
  );
  assert.ok(
    afterYearCaches.length <= Math.ceil(afterYear.tiles.length * 0.03),
    'yearly regeneration should keep squirrel cache counts bounded and avoid unbounded accumulation',
  );

  let rolling = afterYear;
  for (let i = 0; i < 4; i += 1) {
    rolling = advanceDay(rolling, 40);
    const rollingCount = rolling.tiles.filter((tile) => tile.squirrelCache).length;
    assert.ok(
      rollingCount <= Math.ceil(rolling.tiles.length * 0.03),
      'multi-year squirrel cache regeneration should remain bounded without accumulating stale yearly caches',
    );
  }

  assert.ok(
    Math.abs(afterYearCaches.length - initialCacheCount) <= Math.ceil(withCaches.tiles.length * 0.02),
    'yearly squirrel cache regeneration should remain in same magnitude rather than stacking indefinitely',
  );

  const secondTrigger = generateSquirrelCaches(withCaches);
  assert.equal(
    secondTrigger,
    withCaches,
    'squirrel cache generation should be one-time and return same state when already generated',
  );
}

function runSquirrelCacheGenerationUsesSquirrelDensityModelingTest() {
  const baseState = getStabilizedState(28711, { width: 60, height: 60 }, 400);
  const baseSnapshot = serializeGameState(baseState);

  const lowDensityState = deserializeGameState(baseSnapshot);
  lowDensityState.animalZonesGenerated = true;
  lowDensityState.animalDensityByZone = { sciurus_carolinensis: {} };

  const highDensityState = deserializeGameState(baseSnapshot);
  highDensityState.animalZonesGenerated = true;
  highDensityState.animalDensityByZone = { sciurus_carolinensis: {} };

  for (const tile of lowDensityState.tiles) {
    if (!tile.waterType && !tile.rockType) {
      lowDensityState.animalDensityByZone.sciurus_carolinensis[`${tile.x},${tile.y}`] = 0.05;
    }
  }

  for (const tile of highDensityState.tiles) {
    if (tile.waterType || tile.rockType) {
      continue;
    }
    const inHotspot = tile.x >= 15 && tile.x <= 40 && tile.y >= 15 && tile.y <= 40;
    highDensityState.animalDensityByZone.sciurus_carolinensis[`${tile.x},${tile.y}`] = inHotspot ? 0.95 : 0.12;
  }

  const lowCaches = generateSquirrelCaches(lowDensityState);
  const highCaches = generateSquirrelCaches(highDensityState);
  const lowCount = lowCaches.tiles.filter((tile) => tile.squirrelCache).length;
  const highCount = highCaches.tiles.filter((tile) => tile.squirrelCache).length;

  assert.ok(
    highCount > lowCount,
    'higher modeled squirrel density should produce more squirrel caches per yearly generation pass',
  );

  const hotspotCacheCount = highCaches.tiles.filter((tile) => tile.squirrelCache
    && tile.x >= 15 && tile.x <= 40
    && tile.y >= 15 && tile.y <= 40).length;
  assert.ok(
    hotspotCacheCount / Math.max(1, highCount) >= 0.3,
    'cache placement should bias toward high squirrel-density hotspots from animal modeling',
  );
}

function runBeehiveAndSquirrelCacheSnapshotRoundTripTest() {
  const stabilized = getStabilizedState(28711, { width: 60, height: 60 }, 400);
  const withBeehives = generateBeehives(stabilized);
  const withCaches = generateSquirrelCaches(withBeehives);

  const payload = serializeGameState(withCaches);
  const loaded = deserializeGameState(payload);

  assert.equal(loaded.beehivesGenerated, true, 'snapshot round-trip should preserve beehive generation flag');
  assert.equal(
    loaded.squirrelCachesGenerated,
    true,
    'snapshot round-trip should preserve squirrel cache generation flag',
  );
  assert.equal(
    JSON.stringify(loaded.runSquirrelCacheNutPool),
    JSON.stringify(withCaches.runSquirrelCacheNutPool),
    'snapshot round-trip should preserve squirrel nut species run pool',
  );

  const beehiveSignatureBefore = withCaches.tiles
    .filter((tile) => tile.beehive)
    .map((tile) => `${tile.x},${tile.y}:${tile.beehive.speciesId}`)
    .sort()
    .join('|');
  const beehiveSignatureAfter = loaded.tiles
    .filter((tile) => tile.beehive)
    .map((tile) => `${tile.x},${tile.y}:${tile.beehive.speciesId}`)
    .sort()
    .join('|');
  assert.equal(beehiveSignatureAfter, beehiveSignatureBefore, 'snapshot should preserve beehive tile assignments');

  const cacheSignatureBefore = withCaches.tiles
    .filter((tile) => tile.squirrelCache)
    .map((tile) => `${tile.x},${tile.y}:${tile.squirrelCache.placementType}:${tile.squirrelCache.cachedSpeciesId}:${tile.squirrelCache.cachedPartName}:${tile.squirrelCache.cachedSubStageId}`)
    .sort()
    .join('|');
  const cacheSignatureAfter = loaded.tiles
    .filter((tile) => tile.squirrelCache)
    .map((tile) => `${tile.x},${tile.y}:${tile.squirrelCache.placementType}:${tile.squirrelCache.cachedSpeciesId}:${tile.squirrelCache.cachedPartName}:${tile.squirrelCache.cachedSubStageId}`)
    .sort()
    .join('|');
  assert.equal(cacheSignatureAfter, cacheSignatureBefore, 'snapshot should preserve squirrel cache tile assignments');
}

function runAnimalZoneGenerationGateAndPermanenceTest() {
  const state = createInitialGameState(31777, { width: 40, height: 40 });
  assert.equal(
    canGenerateAnimalZones(state),
    false,
    'animal density zones should be gated until stabilization threshold is reached',
  );

  const stabilized = getStabilizedState(10777, { width: 40, height: 40 }, 400);
  assert.equal(
    canGenerateAnimalZones(stabilized),
    true,
    'animal density zones should unlock after stabilization horizon',
  );

  const withZones = generateAnimalZones(stabilized);
  assert.equal(withZones.animalZonesGenerated, true, 'animal generation should set generated flag');
  assert.equal(withZones.animalZoneGrid, null, 'animal generation should not require zone-grid metadata');
  assert.ok(
    Object.keys(withZones.animalDensityByZone || {}).length >= 2,
    'animal generation should produce species density maps for rabbit and squirrel',
  );

  const densitySignature = JSON.stringify(withZones.animalDensityByZone);

  const afterYears = advanceDay(withZones, 120);
  assert.equal(
    JSON.stringify(afterYears.animalDensityByZone),
    densitySignature,
    'animal density map should remain stable across regular advanceDay calls after generation',
  );

  const secondTrigger = generateAnimalZones(withZones);
  assert.equal(
    secondTrigger,
    withZones,
    'animal generation should be one-time and return same state when already generated',
  );
}

function runAnimalZoneSnapshotRoundTripTest() {
  const stabilized = getStabilizedState(10777, { width: 40, height: 40 }, 400);
  const withZones = generateAnimalZones(stabilized);
  assert.equal(withZones.animalZonesGenerated, true, 'animal snapshot test requires generated densities');

  const payload = serializeGameState(withZones);
  const loaded = deserializeGameState(payload);
  assert.equal(
    loaded.animalZonesGenerated,
    true,
    'snapshot round-trip should preserve animal generated-state flag',
  );
  assert.equal(
    JSON.stringify(loaded.animalDensityByZone),
    JSON.stringify(withZones.animalDensityByZone),
    'snapshot round-trip should preserve per-tile animal densities',
  );
}

function runAnimalDensitySignalBiasTest() {
  const state = createInitialGameState(33777, { width: 24, height: 24 });
  state.dayOfYear = 5;
  state.year = 1;
  state.totalDaysSimulated = 400;
  state.plants = {};
  state.nextPlantNumericId = 1;
  state.animalZonesGenerated = false;
  state.animalZoneGrid = null;
  state.animalDensityByZone = {};

  for (const tile of state.tiles) {
    tile.plantIds = [];
    tile.waterType = null;
    tile.waterDepth = null;
    tile.rockType = null;
  }

  function addPlant(id, speciesId, x, y, stageName, age) {
    state.plants[id] = {
      id,
      speciesId,
      age,
      x,
      y,
      stageName,
      alive: true,
      vitality: 1,
      activeSubStages: [],
      source: 'test',
    };
    state.tiles[y * state.width + x].plantIds = [id];
  }

  addPlant('rabbit_food_1', 'daucus_carota', 2, 2, 'first_year_vegetative', 10);
  addPlant('rabbit_food_2', 'daucus_carota', 3, 2, 'first_year_vegetative', 12);
  addPlant('rabbit_food_3', 'daucus_carota', 2, 3, 'first_year_vegetative', 14);

  addPlant('squirrel_food_1', 'juglans_nigra', 20, 20, 'mature_vegetative', 420);
  addPlant('squirrel_food_2', 'juglans_nigra', 19, 20, 'mature_vegetative', 425);
  addPlant('squirrel_food_immature', 'juglans_nigra', 6, 20, 'seedling', 60);

  const withZones = generateAnimalZones(state);
  assert.equal(withZones.animalZonesGenerated, true, 'signal bias test requires generated animal densities');

  const rabbitAtCarrotZone = getAnimalDensityAtTile(withZones, 'sylvilagus_floridanus', 2, 2);
  const rabbitAtWalnutZone = getAnimalDensityAtTile(withZones, 'sylvilagus_floridanus', 20, 20);
  const squirrelAtCarrotZone = getAnimalDensityAtTile(withZones, 'sciurus_carolinensis', 2, 2);
  const squirrelAtWalnutZone = getAnimalDensityAtTile(withZones, 'sciurus_carolinensis', 20, 20);
  const squirrelAtImmatureWalnut = getAnimalDensityAtTile(withZones, 'sciurus_carolinensis', 6, 20);

  assert.ok(
    rabbitAtCarrotZone > rabbitAtWalnutZone,
    'rabbit density should skew higher near concentrated carrot food signal than walnut zone',
  );
  assert.ok(
    squirrelAtWalnutZone > squirrelAtCarrotZone,
    'squirrel density should skew higher near mature walnut tree signal than carrot zone',
  );
  assert.ok(
    squirrelAtWalnutZone > squirrelAtImmatureWalnut,
    'mature nut trees should contribute more squirrel support than immature nut trees',
  );
}

function runFishPopulationGenerationGateAndPermanenceTest() {
  const state = createInitialGameState(34777, { width: 40, height: 40 });
  assert.equal(
    canGenerateFishPopulations(state),
    true,
    'fish populations should be available without long stabilization delay',
  );

  const withFish = generateFishPopulations(state);
  assert.equal(withFish.fishPopulationsGenerated, true, 'fish generation should set generated flag');
  assert.ok(
    Object.keys(withFish.fishDensityByTile || {}).length >= 6,
    'fish generation should produce fish density maps for initial fish species',
  );
  assert.ok(
    Object.keys(withFish.fishWaterBodies || {}).length > 0,
    'fish generation should identify connected water bodies',
  );

  const fishDensitySignature = JSON.stringify(withFish.fishDensityByTile);
  const waterBodiesSignature = JSON.stringify(withFish.fishWaterBodies);
  const waterBodyByTileSignature = JSON.stringify(withFish.fishWaterBodyByTile);

  const afterDays = advanceDay(withFish, 60);
  assert.equal(
    JSON.stringify(afterDays.fishDensityByTile),
    fishDensitySignature,
    'fish density map should remain stable across regular advanceDay calls after generation',
  );
  assert.equal(
    JSON.stringify(afterDays.fishWaterBodies),
    waterBodiesSignature,
    'water-body metadata should remain stable after generation',
  );
  assert.equal(
    JSON.stringify(afterDays.fishWaterBodyByTile),
    waterBodyByTileSignature,
    'water-body tile mapping should remain stable after generation',
  );

  const secondTrigger = generateFishPopulations(withFish);
  assert.equal(
    secondTrigger,
    withFish,
    'fish generation should be one-time and return same state when already generated',
  );
}

function runFishPopulationSnapshotRoundTripTest() {
  const state = createInitialGameState(35777, { width: 40, height: 40 });
  const withFish = generateFishPopulations(state);
  assert.equal(withFish.fishPopulationsGenerated, true, 'fish snapshot test requires generated fish densities');

  const payload = serializeGameState(withFish);
  const loaded = deserializeGameState(payload);
  assert.equal(
    loaded.fishPopulationsGenerated,
    true,
    'snapshot round-trip should preserve fish generated-state flag',
  );
  assert.equal(
    JSON.stringify(loaded.fishDensityByTile),
    JSON.stringify(withFish.fishDensityByTile),
    'snapshot round-trip should preserve fish per-tile densities',
  );
  assert.equal(
    JSON.stringify(loaded.fishWaterBodies),
    JSON.stringify(withFish.fishWaterBodies),
    'snapshot round-trip should preserve fish water-body metadata',
  );
  assert.equal(
    JSON.stringify(loaded.fishEquilibriumByTile),
    JSON.stringify(withFish.fishEquilibriumByTile),
    'snapshot round-trip should preserve fish equilibrium density map',
  );
}

function runFishPopulationRecoveryTowardEquilibriumTest() {
  const state = createInitialGameState(36877, { width: 50, height: 50 });
  const withFish = generateFishPopulations(state);
  const speciesId = 'lepomis_macrochirus';
  const equilibriumByTile = withFish.fishEquilibriumByTile?.[speciesId] || {};

  const targetEntry = Object.entries(equilibriumByTile)
    .find(([, equilibrium]) => Number(equilibrium) > 0.4);
  assert.ok(targetEntry, 'test setup requires a tile with positive fish equilibrium density');

  const [tileKey, equilibriumRaw] = targetEntry;
  const [xRaw, yRaw] = tileKey.split(',');
  const x = Number(xRaw);
  const y = Number(yRaw);
  const equilibrium = Number(equilibriumRaw);

  withFish.fishDensityByTile[speciesId][tileKey] = 0;
  const day1 = advanceDay(withFish, 1);
  const day1Density = getFishDensityAtTile(day1, speciesId, x, y);
  assert.ok(
    day1Density > 0,
    'fish density should recover from depleted value after one day',
  );
  assert.ok(
    day1Density <= equilibrium,
    'recovered fish density should not exceed equilibrium in one-day recovery',
  );

  const day5 = advanceDay(day1, 4);
  const day5Density = getFishDensityAtTile(day5, speciesId, x, y);
  assert.ok(
    day5Density > day1Density,
    'fish density should continue increasing toward equilibrium over multiple days',
  );
  assert.ok(
    day5Density <= equilibrium,
    'multi-day fish recovery should remain capped at equilibrium',
  );

  const longRun = advanceDay(day5, 80);
  const longRunDensity = getFishDensityAtTile(longRun, speciesId, x, y);
  assert.ok(
    Math.abs(longRunDensity - equilibrium) <= 1e-6,
    'fish density should converge to equilibrium and stop there',
  );
}

function runFishDensityDeterminismAndVarianceTest() {
  const seed = 36888;
  const width = 60;
  const height = 60;

  const first = generateFishPopulations(createInitialGameState(seed, { width, height }));
  const second = generateFishPopulations(createInitialGameState(seed, { width, height }));

  assert.equal(
    JSON.stringify(first.fishDensityByTile),
    JSON.stringify(second.fishDensityByTile),
    'fish density generation should be deterministic for identical seed and map dimensions',
  );

  const candidateSpecies = ['catostomus_commersonii', 'lepomis_macrochirus', 'semotilus_atromaculatus'];
  let spread = null;

  for (const speciesId of candidateSpecies) {
    const values = [];
    for (const tile of first.tiles) {
      if (!tile.waterType) {
        continue;
      }
      const density = getFishDensityAtTile(first, speciesId, tile.x, tile.y);
      if (density > 0) {
        values.push(density);
      }
    }

    if (values.length < 8) {
      continue;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const candidateSpread = max - min;
    if (spread === null || candidateSpread > spread) {
      spread = candidateSpread;
    }
  }

  assert.ok(
    Number.isFinite(spread) && spread > 0.02,
    'at least one fish species should show meaningful non-flat variation across eligible water tiles',
  );
}

function runFishDensityHabitatSignalTest() {
  const state = createInitialGameState(36777, { width: 30, height: 30 });

  for (const tile of state.tiles) {
    tile.waterType = null;
    tile.waterDepth = null;
    tile.waterCurrentStrength = 0;
    tile.waterCurrentBand = null;
    tile.rockType = null;
  }

  const pondTile = state.tiles[2 * state.width + 2];
  pondTile.waterType = 'pond';
  pondTile.waterDepth = 'deep';

  const streamTile = state.tiles[10 * state.width + 10];
  streamTile.waterType = 'river';
  streamTile.waterDepth = 'shallow';
  streamTile.waterCurrentStrength = 0.2;
  streamTile.waterCurrentBand = 'slow';

  const fastRiverTile = state.tiles[10 * state.width + 11];
  fastRiverTile.waterType = 'river';
  fastRiverTile.waterDepth = 'deep';
  fastRiverTile.waterCurrentStrength = 0.9;
  fastRiverTile.waterCurrentBand = 'fast';

  const landTile = state.tiles[4 * state.width + 4];

  const withFish = generateFishPopulations(state);
  assert.equal(withFish.fishPopulationsGenerated, true, 'fish habitat signal test requires generated fish densities');

  const creekChubAtStream = getFishDensityAtTile(
    withFish,
    'semotilus_atromaculatus',
    streamTile.x,
    streamTile.y,
  );
  const creekChubAtPond = getFishDensityAtTile(
    withFish,
    'semotilus_atromaculatus',
    pondTile.x,
    pondTile.y,
  );
  const bluegillAtPond = getFishDensityAtTile(
    withFish,
    'lepomis_macrochirus',
    pondTile.x,
    pondTile.y,
  );
  const bluegillAtFastRiver = getFishDensityAtTile(
    withFish,
    'lepomis_macrochirus',
    fastRiverTile.x,
    fastRiverTile.y,
  );
  const bluegillOnLand = getFishDensityAtTile(
    withFish,
    'lepomis_macrochirus',
    landTile.x,
    landTile.y,
  );

  assert.ok(
    creekChubAtStream > creekChubAtPond,
    'creek chub density should be higher in stream habitat than pond habitat',
  );
  assert.ok(
    bluegillAtPond > bluegillAtFastRiver,
    'bluegill density should be higher in pond habitat than fast-current river habitat',
  );
  assert.equal(
    bluegillOnLand,
    0,
    'fish density should always be zero on non-water tiles',
  );
}

function runLogFungusYearlyColonizationTest() {
  const state = createInitialGameState(40777, { width: 30, height: 30 });
  state.dayOfYear = 31;
  state.year = 1;
  state.totalDaysSimulated = 0;
  state.runFungusPool = ['trametes_versicolor'];

  for (const tile of state.tiles) {
    tile.plantIds = [];
    tile.waterType = null;
    tile.waterDepth = null;
    tile.rockType = null;
  }

  const logHostTiles = [
    state.tiles[10 * state.width + 10],
    state.tiles[10 * state.width + 12],
    state.tiles[12 * state.width + 10],
  ];

  for (const tile of logHostTiles) {
    tile.moisture = 0.8;
    tile.deadLog = {
      sourceSpeciesId: 'juglans_nigra',
      sizeAtDeath: 9,
      decayStage: 2,
      createdYear: 0,
      createdDayOfYear: 1,
      fungi: [],
    };
  }

  let candidate = state;
  let colonizedAny = false;
  for (let year = 0; year < 6; year += 1) {
    candidate = advanceDay(candidate, 40);
    colonizedAny = candidate.tiles
      .filter((tile) => tile.deadLog)
      .some((tile) => (tile.deadLog.fungi || []).some((entry) => entry.species_id === 'trametes_versicolor'));
    if (colonizedAny) {
      break;
    }
  }

  assert.equal(
    colonizedAny,
    true,
    'yearly dead-log colonization should eventually establish tree mushrooms on eligible logs',
  );
}

function runLogFungusFruitingWindowResetTest() {
  const state = createInitialGameState(50777, { width: 20, height: 20 });
  state.dayOfYear = 5;
  state.year = 1;

  for (const tile of state.tiles) {
    tile.plantIds = [];
    tile.waterType = null;
    tile.waterDepth = null;
    tile.deadLog = null;
    tile.rockType = null;
  }

  const hostTile = state.tiles[8 * state.width + 8];
  hostTile.moisture = 0.8;
  hostTile.deadLog = {
    sourceSpeciesId: 'juglans_nigra',
    sizeAtDeath: 10,
    decayStage: 2,
    createdYear: 0,
    createdDayOfYear: 1,
    fungi: [
      {
        species_id: 'trametes_versicolor',
        yield_current_grams: 0,
        fruiting_windows: [{ startDay: 5, endDay: 8 }],
        per_log_yield_range: [50, 50],
        log_size_multiplier: 1,
        rolled_year_by_window: {},
      },
    ],
  };

  const fruited = advanceDay(state, 1);
  const fruitedTile = fruited.tiles[hostTile.y * fruited.width + hostTile.x];
  const fruitedEntry = fruitedTile.deadLog.fungi[0];
  assert.ok(
    fruitedEntry.yield_current_grams > 0,
    'log fungus should roll positive yield on fruiting window open day',
  );

  const afterWindow = advanceDay(fruited, 5);
  const afterWindowTile = afterWindow.tiles[hostTile.y * afterWindow.width + hostTile.x];
  const closedEntry = afterWindowTile.deadLog.fungi[0];
  assert.equal(
    closedEntry.yield_current_grams,
    0,
    'log fungus yield should reset to zero outside fruiting window',
  );
}

function runPhantomOccupancyCleanupTest() {
  const state = createInitialGameState(10000, { width: 80, height: 80 });
  const targetTile = state.tiles.find((tile) => !tile.waterType && tile.plantIds.length === 0);
  assert.ok(targetTile, 'expected at least one empty land tile for phantom occupancy regression test');

  targetTile.plantIds = ['phantom_plant_id'];
  const advanced = advanceDay(state, 1);
  const sameTile = advanced.tiles[targetTile.y * advanced.width + targetTile.x];

  assert.equal(
    sameTile.plantIds.includes('phantom_plant_id'),
    false,
    'advanceDay should clear phantom tile occupancy references',
  );

  const staleRef = advanced.tiles.find((tile) => tile.plantIds.some((plantId) => !advanced.plants[plantId]));
  assert.equal(
    staleRef,
    undefined,
    'tiles should not retain plantIds that do not exist in state.plants after daily reconciliation',
  );
}

function tileInSpeciesTolerance(tile, species) {
  const [phMin, phMax] = species.soil.ph_range;
  if (tile.ph < phMin || tile.ph > phMax) {
    return false;
  }

  const [drainMin, drainMax] = species.soil.drainage.tolerance_range;
  const drainIdx = drainageToIndex(tile.drainage);
  if (drainIdx < drainMin || drainIdx > drainMax) {
    return false;
  }

  const [fertMin, fertMax] = species.soil.fertility.tolerance_range;
  if (tile.fertility < fertMin || tile.fertility > fertMax) {
    return false;
  }

  const [moistureMin, moistureMax] = species.soil.moisture.tolerance_range;
  if (tile.moisture < moistureMin || tile.moisture > moistureMax) {
    return false;
  }

  const [shadeMin, shadeMax] = species.soil.shade.tolerance_range;
  const effectiveShade = Number.isFinite(tile.effectiveShadeForOccupant)
    ? tile.effectiveShadeForOccupant
    : tile.shade;
  if (effectiveShade < shadeMin || effectiveShade > shadeMax) {
    return false;
  }

  return true;
}

function tilePassesStrictGerminationGates(tile, species) {
  const [drainMin, drainMax] = species.soil.drainage.tolerance_range;
  const drainIdx = drainageToIndex(tile.drainage);
  if (drainIdx < drainMin || drainIdx > drainMax) {
    return false;
  }

  const [fertMin, fertMax] = species.soil.fertility.tolerance_range;
  if (tile.fertility < fertMin || tile.fertility > fertMax) {
    return false;
  }

  const [moistureMin, moistureMax] = species.soil.moisture.tolerance_range;
  if (tile.moisture < moistureMin || tile.moisture > moistureMax) {
    return false;
  }

  const [shadeMin, shadeMax] = species.soil.shade.tolerance_range;
  if (tile.shade < shadeMin || tile.shade > shadeMax) {
    return false;
  }

  return true;
}

function seedSpeciesEverywhere(state, speciesId, age = 0, source = 'founder') {
  let nextNumericId = 1;
  state.plants = {};

  for (const tile of state.tiles) {
    tile.plantIds = [];
    tile.dormantSeeds = {};
    tile.waterType = null;
    tile.rockType = null;

    const plantId = `seeded_${speciesId}_${nextNumericId}`;
    nextNumericId += 1;
    state.plants[plantId] = {
      id: plantId,
      speciesId,
      age,
      x: tile.x,
      y: tile.y,
      stageName: 'seedling',
      alive: true,
      vitality: 1,
      source,
    };
    tile.plantIds.push(plantId);
  }
}

function runNoUnsuitableSeedlingGerminationTest() {
  const speciesId = 'daucus_carota';

  withSpeciesDispersalOverride(
    speciesId,
    {
      germination_rate: 1,
      germination_season: 'spring',
      requires_disturbance: false,
      pioneer: false,
      viable_lifespan_days: 500,
    },
    () => {
      const species = PLANT_BY_ID[speciesId];
      const state = createInitialGameState(99313, { width: 20, height: 20 });
      state.dayOfYear = 5;
      state.plants = {};

      for (const tile of state.tiles) {
        tile.plantIds = [];
        tile.dormantSeeds = {};
        tile.waterType = null;
        tile.rockType = null;
        tile.disturbed = true;
        tile.ph = (species.soil.ph_range[0] + species.soil.ph_range[1]) / 2;
        tile.fertility = species.soil.fertility.tolerance_range[0] - 0.2;
        tile.moisture = (species.soil.moisture.tolerance_range[0] + species.soil.moisture.tolerance_range[1]) / 2;
        tile.drainage = 'well';
        tile.baseShade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;
        tile.shade = tile.baseShade;
        tile.dormantSeeds[speciesId] = { ageDays: 0 };
      }

      const next = advanceDay(state, 3);
      const speciesPlants = Object.values(next.plants).filter((plant) => plant.speciesId === speciesId);
      assert.equal(
        speciesPlants.length,
        0,
        'seeds should not germinate on tiles that fail strict survival tolerance checks',
      );
    },
  );
}

function runDisturbanceAwareGerminationTest() {
  const speciesId = 'urtica_dioica';
  const species = PLANT_BY_ID[speciesId];

  function setupState(seed, disturbed) {
    const state = createInitialGameState(seed, { width: 20, height: 20 });
    state.dayOfYear = 5;
    state.plants = {};

    for (const tile of state.tiles) {
      tile.plantIds = [];
      tile.dormantSeeds = {};
      tile.waterType = null;
      tile.rockType = null;
      tile.ph = (species.soil.ph_range[0] + species.soil.ph_range[1]) / 2;
      tile.fertility = (species.soil.fertility.tolerance_range[0] + species.soil.fertility.tolerance_range[1]) / 2;
      tile.moisture = (species.soil.moisture.tolerance_range[0] + species.soil.moisture.tolerance_range[1]) / 2;
      tile.drainage = 'moderate';
      tile.baseShade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;
      tile.shade = tile.baseShade;
      tile.disturbed = disturbed;
      tile.dormantSeeds[speciesId] = { ageDays: 0 };
    }

    return state;
  }

  withSpeciesDispersalOverride(
    speciesId,
    {
      germination_rate: 1,
      requires_disturbance: true,
      pioneer: true,
      viable_lifespan_days: 500,
    },
    () => {
      const blocked = advanceDay(setupState(99101, false), 3);
      const blockedPlants = Object.values(blocked.plants).filter((plant) => plant.speciesId === speciesId).length;
      assert.ok(blockedPlants > 0, 'requires_disturbance species should still have a small germination chance on undisturbed tiles');

      const allowed = advanceDay(setupState(99101, true), 3);
      const allowedPlants = Object.values(allowed.plants).filter((plant) => plant.speciesId === speciesId).length;
      assert.ok(
        allowedPlants > blockedPlants,
        'disturbed tiles should produce materially more germination than undisturbed tiles for requires_disturbance species',
      );
    },
  );
}

function runVitalityStressAndRecoveryTest() {
  const speciesId = 'juglans_nigra';
  const species = PLANT_BY_ID[speciesId];
  const state = createInitialGameState(99202, { width: 20, height: 20 });
  state.dayOfYear = 5;
  state.plants = {};
  state.nextPlantNumericId = 3;

  for (const tile of state.tiles) {
    tile.plantIds = [];
    tile.dormantSeeds = {};
    tile.waterType = null;
    tile.rockType = null;
    tile.disturbed = false;
    tile.baseShade = 0.2;
    tile.shade = 0.2;
  }

  const healthyTile = state.tiles[6 * state.width + 6];
  healthyTile.ph = (species.soil.ph_range[0] + species.soil.ph_range[1]) / 2;
  healthyTile.fertility = (species.soil.fertility.tolerance_range[0] + species.soil.fertility.tolerance_range[1]) / 2;
  healthyTile.moisture = (species.soil.moisture.tolerance_range[0] + species.soil.moisture.tolerance_range[1]) / 2;
  healthyTile.drainage = 'well';
  healthyTile.baseShade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;
  healthyTile.shade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;

  const stressedTile = state.tiles[13 * state.width + 13];
  stressedTile.ph = species.soil.ph_range[0] - 2;
  stressedTile.fertility = 0;
  stressedTile.moisture = 0;
  stressedTile.drainage = 'poor';
  stressedTile.baseShade = 1;
  stressedTile.shade = 1;

  state.plants.recovery_candidate = {
    id: 'recovery_candidate',
    speciesId,
    age: species.ageOfMaturity + 80,
    x: healthyTile.x,
    y: healthyTile.y,
    stageName: 'mature',
    alive: true,
    vitality: 0.35,
    source: 'test',
  };
  healthyTile.plantIds = ['recovery_candidate'];

  state.plants.stress_candidate = {
    id: 'stress_candidate',
    speciesId,
    age: species.ageOfMaturity + 80,
    x: stressedTile.x,
    y: stressedTile.y,
    stageName: 'mature',
    alive: true,
    vitality: 1,
    source: 'test',
  };
  stressedTile.plantIds = ['stress_candidate'];

  const dayOne = advanceDay(state, 1);
  const recoveredAfterOne = dayOne.plants.recovery_candidate;
  const stressedAfterOne = dayOne.plants.stress_candidate;
  assert.ok(
    recoveredAfterOne && recoveredAfterOne.vitality > 0.35,
    'in-range perennial should recover vitality in spring/summer',
  );
  assert.ok(
    stressedAfterOne && stressedAfterOne.vitality < 1,
    'out-of-range plant should lose vitality based on stress each day',
  );

  const longRun = advanceDay(state, 60);
  assert.equal(
    !!longRun.plants.stress_candidate,
    false,
    'sustained severe stress should eventually kill plant via vitality depletion',
  );
}

function runPerennialWinterMortalityAmortizedTest() {
  const speciesId = 'juglans_nigra';
  const species = PLANT_BY_ID[speciesId];

  const setupState = (seed, age, stride = 5) => {
    const state = createInitialGameState(seed, { width: 42, height: 42 });
    state.dayOfYear = 31;
    state.plants = {};
    state.nextPlantNumericId = 1;

    const midPh = (species.soil.ph_range[0] + species.soil.ph_range[1]) / 2;
    const midFertility = (species.soil.fertility.tolerance_range[0] + species.soil.fertility.tolerance_range[1]) / 2;
    const midMoisture = (species.soil.moisture.tolerance_range[0] + species.soil.moisture.tolerance_range[1]) / 2;
    const midShade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;

    for (const tile of state.tiles) {
      tile.plantIds = [];
      tile.dormantSeeds = {};
      tile.waterType = null;
      tile.waterDepth = null;
      tile.rockType = null;
      tile.disturbed = false;
      tile.ph = midPh;
      tile.fertility = midFertility;
      tile.moisture = midMoisture;
      tile.drainage = 'well';
      tile.baseShade = midShade;
      tile.shade = midShade;
    }

    let nextNumericId = 1;
    for (let y = 2; y < state.height - 2; y += stride) {
      for (let x = 2; x < state.width - 2; x += stride) {
        const tile = state.tiles[y * state.width + x];
        const plantId = `winter_probe_${nextNumericId}`;
        nextNumericId += 1;
        state.plants[plantId] = {
          id: plantId,
          speciesId,
          age,
          x,
          y,
          stageName: 'mature',
          alive: true,
          vitality: 1,
          source: 'test',
          activeSubStages: [],
        };
        tile.plantIds = [plantId];
      }
    }

    state.nextPlantNumericId = nextNumericId;
    return state;
  };

  const oldState = setupState(99321, species.ageOfMaturity * 2);
  const initialOldCount = Object.keys(oldState.plants).length;
  let previousOldState = oldState;
  const aggregatedWinterDayDeaths = new Array(10).fill(0);

  for (let winter = 0; winter < 6; winter += 1) {
    for (let day = 0; day < 10; day += 1) {
      const next = advanceDay(previousOldState, 1);
      const previousCount = Object.keys(previousOldState.plants).length;
      const nextCount = Object.keys(next.plants).length;
      aggregatedWinterDayDeaths[day] += previousCount - nextCount;
      previousOldState = next;
    }

    if (winter < 5) {
      previousOldState = advanceDay(previousOldState, 30);
    }
  }

  const totalOldDeaths = aggregatedWinterDayDeaths.reduce((sum, value) => sum + value, 0);
  const firstWinterDayDeaths = aggregatedWinterDayDeaths[0] || 0;
  const daysWithDeaths = aggregatedWinterDayDeaths.filter((value) => value > 0).length;
  assert.ok(totalOldDeaths > 0, 'old perennials should experience winter mortality over multiple winters');
  assert.ok(totalOldDeaths < initialOldCount, 'winter old-age mortality should be partial and not wipe all old perennials');
  assert.ok(daysWithDeaths > 1, 'winter old-age mortality should appear on multiple winter days');
  assert.ok(
    firstWinterDayDeaths < totalOldDeaths,
    'winter old-age mortality should be amortized and not concentrated on the first winter day',
  );
}

function maxStageSizeForSpecies(species) {
  return (species.lifeStages || []).reduce((maxSize, stage) => {
    const size = Number.isFinite(stage?.size) ? stage.size : 1;
    return Math.max(maxSize, size);
  }, 1);
}

function runDeadLogCreationOnTreeDeathTest() {
  const largePerennialSpeciesId = 'juglans_nigra';
  const largePerennialSpecies = PLANT_BY_ID[largePerennialSpeciesId];
  assert.ok(
    maxStageSizeForSpecies(largePerennialSpecies) > 7,
    'test precondition: expected juglans_nigra to qualify as tree-sized perennial',
  );

  const setupSinglePlantStressState = (seed, speciesId, stageName, age) => {
    const species = PLANT_BY_ID[speciesId];
    const state = createInitialGameState(seed, { width: 20, height: 20 });
    state.dayOfYear = 5;
    state.plants = {};
    state.nextPlantNumericId = 2;

    for (const tile of state.tiles) {
      tile.plantIds = [];
      tile.dormantSeeds = {};
      tile.waterType = null;
      tile.waterDepth = null;
      tile.deadLog = null;
      tile.rockType = null;
      tile.disturbed = false;
      tile.ph = species.soil.ph_range[0] - 2.5;
      tile.fertility = 0;
      tile.moisture = 0;
      tile.drainage = 'poor';
      tile.baseShade = 1;
      tile.shade = 1;
    }

    const hostTile = state.tiles[8 * state.width + 8];
    const plantId = `dead_log_probe_${speciesId}`;
    state.plants[plantId] = {
      id: plantId,
      speciesId,
      age,
      x: hostTile.x,
      y: hostTile.y,
      stageName,
      alive: true,
      vitality: 0.001,
      activeSubStages: [],
      source: 'test',
    };
    hostTile.plantIds = [plantId];

    return { state, hostTile, plantId };
  };

  const qualifying = setupSinglePlantStressState(99341, largePerennialSpeciesId, 'mature_vegetative', 400);
  const qualifyingNext = advanceDay(qualifying.state, 1);
  const qualifyingTile = qualifyingNext.tiles[qualifying.hostTile.y * qualifyingNext.width + qualifying.hostTile.x];

  assert.equal(
    qualifyingNext.plants[qualifying.plantId],
    undefined,
    'qualifying tree should die under severe stress in setup state',
  );
  assert.ok(qualifyingTile.deadLog, 'qualifying dead perennial tree should leave behind dead log tile data');
  assert.equal(
    qualifyingTile.deadLog.sourceSpeciesId,
    largePerennialSpeciesId,
    'dead log should preserve source tree species for future fungus host logic',
  );
  assert.ok(
    qualifyingTile.deadLog.sizeAtDeath > 7,
    'dead log should store tree-size-at-death metadata above tree threshold',
  );
  assert.equal(
    qualifyingTile.deadLog.decayStage,
    1,
    'newly created dead logs should start at decay stage 1',
  );

  const afterOneYear = advanceDay(qualifyingNext, 40);
  const afterOneYearTile = afterOneYear.tiles[qualifying.hostTile.y * afterOneYear.width + qualifying.hostTile.x];
  assert.equal(
    afterOneYearTile.deadLog?.decayStage,
    2,
    'dead logs should advance by one decay stage after one full year',
  );
  assert.ok(
    afterOneYearTile.fertility > qualifyingTile.fertility,
    'host tile fertility should increase when dead logs decay yearly',
  );

  const adjacentAfterOneYear = afterOneYear.tiles[
    (qualifying.hostTile.y + 1) * afterOneYear.width + qualifying.hostTile.x
  ];
  const adjacentBefore = qualifyingNext.tiles[
    (qualifying.hostTile.y + 1) * qualifyingNext.width + qualifying.hostTile.x
  ];
  assert.ok(
    adjacentAfterOneYear.fertility > adjacentBefore.fertility,
    'adjacent tile fertility should also increase from dead-log decay enrichment',
  );

  const afterThreeYears = advanceDay(afterOneYear, 80);
  const afterThreeYearsTile = afterThreeYears.tiles[qualifying.hostTile.y * afterThreeYears.width + qualifying.hostTile.x];
  assert.equal(
    afterThreeYearsTile.deadLog?.decayStage,
    4,
    'dead logs should cap at decay stage 4 even after additional years',
  );

  const afterFourYears = advanceDay(afterThreeYears, 40);
  const afterFourYearsTile = afterFourYears.tiles[qualifying.hostTile.y * afterFourYears.width + qualifying.hostTile.x];
  assert.equal(
    afterFourYearsTile.deadLog,
    null,
    'dead logs should disappear after completing stage 4 decay',
  );
  assert.equal(
    afterFourYearsTile.disturbed,
    true,
    'tile should become disturbed when dead logs fully decompose and disappear',
  );

  const annualCandidateSpeciesId = 'daucus_carota';
  const annual = setupSinglePlantStressState(99342, annualCandidateSpeciesId, 'second_year_seed_set', 48);
  const annualNext = advanceDay(annual.state, 1);
  const annualTile = annualNext.tiles[annual.hostTile.y * annualNext.width + annual.hostTile.x];
  assert.equal(
    annualNext.plants[annual.plantId],
    undefined,
    'annual setup plant should die under severe stress in setup state',
  );
  assert.equal(
    annualTile.deadLog,
    null,
    'non-perennial deaths should not create dead logs',
  );

  const smallPerennialSpeciesId = 'urtica_dioica';
  const smallPerennialSpecies = PLANT_BY_ID[smallPerennialSpeciesId];
  assert.ok(
    maxStageSizeForSpecies(smallPerennialSpecies) <= 7,
    'test precondition: expected urtica_dioica to remain below tree-size threshold',
  );

  const smallPerennial = setupSinglePlantStressState(99343, smallPerennialSpeciesId, 'seed_set', 20);
  const smallPerennialNext = advanceDay(smallPerennial.state, 1);
  const smallPerennialTile = smallPerennialNext.tiles[
    smallPerennial.hostTile.y * smallPerennialNext.width + smallPerennial.hostTile.x
  ];
  assert.equal(
    smallPerennialNext.plants[smallPerennial.plantId],
    undefined,
    'small perennial setup plant should die under severe stress in setup state',
  );
  assert.equal(
    smallPerennialTile.deadLog,
    null,
    'perennials below tree-size threshold should not create dead logs',
  );
}

function runActiveSubStageLifecycleTest() {
  const speciesId = 'daucus_carota';
  const species = PLANT_BY_ID[speciesId];
  const state = createInitialGameState(99303, { width: 20, height: 20 });
  state.dayOfYear = 17;
  state.plants = {};
  state.nextPlantNumericId = 2;

  for (const tile of state.tiles) {
    tile.plantIds = [];
    tile.dormantSeeds = {};
    tile.waterType = null;
    tile.rockType = null;
    tile.baseShade = 0.2;
    tile.shade = 0.2;
  }

  const hostTile = state.tiles[10 * state.width + 10];
  hostTile.ph = (species.soil.ph_range[0] + species.soil.ph_range[1]) / 2;
  hostTile.fertility = (species.soil.fertility.tolerance_range[0] + species.soil.fertility.tolerance_range[1]) / 2;
  hostTile.moisture = (species.soil.moisture.tolerance_range[0] + species.soil.moisture.tolerance_range[1]) / 2;
  hostTile.drainage = 'well';
  hostTile.baseShade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;
  hostTile.shade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;

  state.plants.stage_candidate = {
    id: 'stage_candidate',
    speciesId,
    age: 46,
    x: hostTile.x,
    y: hostTile.y,
    stageName: 'second_year_flowering',
    alive: true,
    vitality: 1,
    activeSubStages: [],
    source: 'test',
  };
  hostTile.plantIds = ['stage_candidate'];

  const activeState = advanceDay(state, 1);
  const activePlant = activeState.plants.stage_candidate;
  assert.ok(activePlant, 'stage test plant should survive initial activation day');
  assert.ok(
    activePlant.activeSubStages.some((entry) => entry.partName === 'flower' && entry.subStageId === 'fresh'),
    'flower sub-stage should activate within configured seasonal window',
  );

  const expiredState = advanceDay(activeState, 1);
  const expiredPlant = expiredState.plants.stage_candidate;
  assert.ok(expiredPlant, 'stage test plant should survive expiry day');
  assert.equal(
    expiredPlant.activeSubStages.some((entry) => entry.partName === 'flower' && entry.subStageId === 'fresh'),
    false,
    'flower sub-stage should expire after seasonal window closes',
  );
}

function runBiennialStageExhaustionDeathTest() {
  const speciesId = 'daucus_carota';
  const species = PLANT_BY_ID[speciesId];
  function setupState(seed, dayOfYear, age, stageName) {
    const state = createInitialGameState(seed, { width: 20, height: 20 });
    state.dayOfYear = dayOfYear;
    state.plants = {};
    state.nextPlantNumericId = 2;

    for (const tile of state.tiles) {
      tile.plantIds = [];
      tile.dormantSeeds = {};
      tile.waterType = null;
      tile.rockType = null;
      tile.disturbed = true;
      tile.baseShade = 0.2;
      tile.shade = 0.2;
    }

    const hostTile = state.tiles[8 * state.width + 8];
    hostTile.ph = (species.soil.ph_range[0] + species.soil.ph_range[1]) / 2;
    hostTile.fertility = (species.soil.fertility.tolerance_range[0] + species.soil.fertility.tolerance_range[1]) / 2;
    hostTile.moisture = (species.soil.moisture.tolerance_range[0] + species.soil.moisture.tolerance_range[1]) / 2;
    hostTile.drainage = 'well';
    hostTile.baseShade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;
    hostTile.shade = hostTile.baseShade;

    const plantId = 'biennial_stage_probe';
    state.plants[plantId] = {
      id: plantId,
      speciesId,
      age,
      x: hostTile.x,
      y: hostTile.y,
      stageName,
      alive: true,
      vitality: 1,
      activeSubStages: [],
      source: 'seed',
    };
    hostTile.plantIds = [plantId];
    return { state, plantId };
  }

  const early = setupState(99307, 5, 40, 'first_year_vegetative');
  const earlyNext = advanceDay(early.state, 1);
  assert.ok(
    earlyNext.plants[early.plantId],
    'biennial should survive after first-year dormancy and continue into second-year development',
  );

  const secondYear = setupState(99308, 10, 45, 'first_year_vegetative');
  const secondYearNext = advanceDay(secondYear.state, 1);
  assert.equal(
    secondYearNext.plants[secondYear.plantId]?.stageName,
    'second_year_vegetative',
    'biennial should transition into second-year vegetative stage when age and seasonal window align',
  );

  const terminal = setupState(99309, 36, 48, 'second_year_seed_set');
  const terminalNext = advanceDay(terminal.state, 1);
  assert.equal(
    terminalNext.plants[terminal.plantId],
    undefined,
    'biennial should die when no seasonal life stage applies after second-year seed set window',
  );
}

function runIncrementalHarvestVitalityDamageTest() {
  const speciesId = 'daucus_carota';
  const species = PLANT_BY_ID[speciesId];
  const state = createInitialGameState(99311, { width: 20, height: 20 });
  state.dayOfYear = 6;
  state.plants = {};

  for (const tile of state.tiles) {
    tile.plantIds = [];
    tile.dormantSeeds = {};
    tile.waterType = null;
    tile.rockType = null;
    tile.baseShade = 0.2;
    tile.shade = 0.2;
  }

  const hostTile = state.tiles[8 * state.width + 8];
  hostTile.ph = (species.soil.ph_range[0] + species.soil.ph_range[1]) / 2;
  hostTile.fertility = (species.soil.fertility.tolerance_range[0] + species.soil.fertility.tolerance_range[1]) / 2;
  hostTile.moisture = (species.soil.moisture.tolerance_range[0] + species.soil.moisture.tolerance_range[1]) / 2;
  hostTile.drainage = 'well';
  hostTile.baseShade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;
  hostTile.shade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;

  state.plants.harvest_candidate = {
    id: 'harvest_candidate',
    speciesId,
    age: 47,
    x: hostTile.x,
    y: hostTile.y,
    stageName: 'second_year_vegetative',
    alive: true,
    vitality: 1,
    activeSubStages: [
      {
        partName: 'stem',
        subStageId: 'green',
        initialActionsRoll: 4,
        seasonalHarvestBudgetActions: 4,
        remainingActions: 4,
        harvestsThisSeason: 0,
        regrowthCountdown: null,
        vitalityDamageAppliedThisSeason: 0,
      },
    ],
    source: 'test',
  };
  hostTile.plantIds = ['harvest_candidate'];

  const firstBurst = applyHarvestAction(state, 'harvest_candidate', 'stem', 'green', { actions: 2 });
  assert.equal(firstBurst.appliedActions, 2, 'should apply requested harvest actions while sub-stage has actions');
  assert.equal(firstBurst.depleted, false, 'sub-stage should remain active before all actions are consumed');
  assert.ok(
    Math.abs(state.plants.harvest_candidate.vitality - 0.6) < 1e-9,
    'non-regrowing stage should apply vitality damage incrementally per harvest action',
  );

  const secondBurst = applyHarvestAction(state, 'harvest_candidate', 'stem', 'green', { actions: 2 });
  assert.equal(secondBurst.appliedActions, 2, 'remaining actions should be harvestable');
  assert.equal(secondBurst.depleted, true, 'sub-stage should report depletion when actions reach zero');
  assert.ok(
    Math.abs(state.plants.harvest_candidate.vitality - 0.2) < 1e-9,
    'total vitality loss across all actions should match harvest_damage budget',
  );
  assert.equal(
    state.plants.harvest_candidate.activeSubStages.some((entry) => entry.partName === 'stem' && entry.subStageId === 'green'),
    false,
    'non-regrowing sub-stage should be removed after final depletion',
  );
}

function runRegrowthSeasonalBudgetVitalityTest() {
  const speciesId = 'urtica_dioica';
  const species = PLANT_BY_ID[speciesId];
  const originalLongevity = species.longevity;
  const state = createInitialGameState(99312, { width: 20, height: 20 });
  state.dayOfYear = 1;
  state.plants = {};

  for (const tile of state.tiles) {
    tile.plantIds = [];
    tile.dormantSeeds = {};
    tile.waterType = null;
    tile.rockType = null;
    tile.baseShade = 0.4;
    tile.shade = 0.4;
  }

  const hostTile = state.tiles[10 * state.width + 10];
  hostTile.ph = (species.soil.ph_range[0] + species.soil.ph_range[1]) / 2;
  hostTile.fertility = (species.soil.fertility.tolerance_range[0] + species.soil.fertility.tolerance_range[1]) / 2;
  hostTile.moisture = (species.soil.moisture.tolerance_range[0] + species.soil.moisture.tolerance_range[1]) / 2;
  hostTile.drainage = 'moderate';
  hostTile.baseShade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;
  hostTile.shade = (species.soil.shade.tolerance_range[0] + species.soil.shade.tolerance_range[1]) / 2;

  state.plants.regrow_candidate = {
    id: 'regrow_candidate',
    speciesId,
    age: 12,
    x: hostTile.x,
    y: hostTile.y,
    stageName: 'vegetative',
    alive: true,
    vitality: 1,
    activeSubStages: [
      {
        partName: 'leaf',
        subStageId: 'young',
        initialActionsRoll: 6,
        seasonalHarvestBudgetActions: 18,
        remainingActions: 6,
        harvestsThisSeason: 0,
        regrowthCountdown: null,
        vitalityDamageAppliedThisSeason: 0,
      },
    ],
    source: 'test',
  };
  hostTile.plantIds = ['regrow_candidate'];
  species.longevity = 'annual';
  try {
    const firstCycle = applyHarvestAction(state, 'regrow_candidate', 'leaf', 'young', { actions: 6 });
    assert.equal(
      firstCycle.appliedActions,
      5,
      'first regrowth cycle should consume all cycle actions (catalog actions_until_depleted midpoint 5)',
    );
    let regrowEntry = state.plants.regrow_candidate.activeSubStages.find(
      (entry) => entry.partName === 'leaf' && entry.subStageId === 'young',
    );
    assert.ok(regrowEntry, 'regrowing stage should remain active after depletion');
    assert.equal(regrowEntry.regrowthCountdown, 5, 'regrowth countdown should start after cycle depletion');
    const cycleBudget = 5;
    assert.ok(
      Math.abs(state.plants.regrow_candidate.vitality - (1 - (cycleBudget * (0.2 / cycleBudget)))) < 1e-9,
      'regrowing stage should divide per-action vitality damage by one depletion-cycle action budget',
    );
  } finally {
    species.longevity = originalLongevity;
  }
}

function runSeed10000FounderMixRegressionTest() {
  const state = createInitialGameState(10000, { width: 80, height: 80 });
  const metrics = getMetrics(state);

  assert.ok(
    metrics.speciesCounts.daucus_carota > 0,
    'seed 10000 should initialize with wild carrot founders',
  );
  assert.ok(
    metrics.speciesCounts.juglans_nigra > 0,
    'seed 10000 should initialize with black walnut founders',
  );
  assert.ok(
    metrics.speciesCounts.urtica_dioica > 0,
    'seed 10000 should initialize with stinging nettle founders',
  );
}

function runInitialDeadTreeGenerationTest() {
  const state = createInitialGameState(10000, { width: 80, height: 80 });
  const deadLogTiles = state.tiles.filter((tile) => tile.deadLog);

  assert.ok(
    deadLogTiles.length > 0,
    'initial map generation should include pre-existing dead tree/log tiles',
  );

  for (const tile of deadLogTiles) {
    assert.equal(tile.waterType, null, 'dead logs should only be placed on land tiles');
    assert.equal(tile.plantIds.length, 0, 'dead log tiles should not retain a living plant occupant');

    assert.ok(
      Number.isFinite(tile.deadLog.sizeAtDeath) && tile.deadLog.sizeAtDeath > 7,
      'initial dead logs should originate from tree-sized plants',
    );
    assert.ok(
      Number.isFinite(tile.deadLog.decayStage)
      && tile.deadLog.decayStage >= 1
      && tile.deadLog.decayStage <= 4,
      'initial dead logs should be assigned a valid decay stage between 1 and 4',
    );

    const sourceSpecies = PLANT_BY_ID[tile.deadLog.sourceSpeciesId];
    assert.ok(sourceSpecies, 'dead log source species must resolve to a catalog species');
    assert.equal(
      sourceSpecies.longevity,
      'perennial',
      'initial dead logs should derive from perennial species only',
    );
  }
}

function runDispersalMechanismsTest() {
  const speciesId = 'daucus_carota';

  withSpeciesDispersalOverride(
    speciesId,
    {
      method: 'wind',
      base_radius_tiles: 8,
      wind_radius_bonus: 6,
      seeds_per_mature_plant: [5000, 5000],
      water_dispersed: false,
      animal_dispersed: false,
    },
    () => {
      const windState = createSinglePlantDispersalState(4101, speciesId);
      const windAfter = advanceDay(windState, 1);
      const windSeeds = collectDormantSeedPositions(windAfter, speciesId);

      assert.ok(windSeeds.length > 0, 'wind dispersal should place dormant seeds');
      assert.ok(
        (windAfter.recentDispersal?.totalsByMethod?.wind || 0) > 0,
        'wind dispersal should record recentDispersal totals for wind',
      );

      withSpeciesDispersalOverride(
        speciesId,
        {
          method: 'explosive',
          base_radius_tiles: 8,
          wind_radius_bonus: 0,
          seeds_per_mature_plant: [5000, 5000],
          water_dispersed: false,
          animal_dispersed: false,
        },
        () => {
          const explosiveState = createSinglePlantDispersalState(4101, speciesId);
          const explosiveAfter = advanceDay(explosiveState, 1);
          const explosiveSeeds = collectDormantSeedPositions(explosiveAfter, speciesId);

          assert.ok(explosiveSeeds.length > 0, 'explosive dispersal should place dormant seeds');

          const windMax = maxManhattanDistance(windSeeds, 24, 24);
          const explosiveMax = maxManhattanDistance(explosiveSeeds, 24, 24);
          assert.ok(
            windMax > explosiveMax,
            `wind dispersal should reach farther than explosive (wind=${windMax}, explosive=${explosiveMax})`,
          );
        },
      );
    },
  );

  withSpeciesDispersalOverride(
    speciesId,
    {
      method: 'water',
      base_radius_tiles: 6,
      wind_radius_bonus: 0,
      seeds_per_mature_plant: [3000, 3000],
      water_dispersed: true,
      animal_dispersed: false,
    },
    () => {
      const waterState = createSinglePlantDispersalState(4201, speciesId, 24, 10);
      for (let y = 0; y < waterState.height; y += 1) {
        const waterTile = waterState.tiles[y * waterState.width + 25];
        waterTile.waterType = 'river';
        waterTile.waterDepth = 'shallow';
        waterTile.waterCurrentStrength = 0.2;
        waterTile.waterCurrentBand = 'slow';
        waterTile.plantIds = [];
      }

      const waterAfter = advanceDay(waterState, 1);
      const waterSeeds = collectDormantSeedPositions(waterAfter, speciesId);

      assert.ok(waterSeeds.length > 0, 'water dispersal should place dormant seeds on banks');
      assert.ok(
        (waterAfter.recentDispersal?.totalsByMethod?.water || 0) > 0,
        'water dispersal should record recentDispersal totals for water',
      );
      assert.equal(
        waterSeeds.some((seed) => seed.waterType),
        false,
        'water dispersal should not leave dormant seeds directly on water tiles',
      );
      assert.ok(
        waterSeeds.some((seed) => seed.y > 10),
        'water dispersal should be biased downstream from the source tile',
      );
    },
  );

  withSpeciesDispersalOverride(
    speciesId,
    {
      method: 'runner',
      base_radius_tiles: 4,
      seeds_per_mature_plant: [0, 0],
      water_dispersed: false,
      animal_dispersed: false,
    },
    () => {
      const runnerState = createSinglePlantDispersalState(4301, speciesId, 20, 20);
      const runnerAfter = advanceDay(runnerState, 1);
      const runnerMetrics = getMetrics(runnerAfter);
      const runnerPlants = Object.values(runnerAfter.plants).filter((plant) => plant.source === 'runner');

      assert.ok(runnerPlants.length > 0, 'runner dispersal should create vegetative runner plants');
      assert.ok(
        (runnerAfter.recentDispersal?.totalsByMethod?.runner || 0) > 0,
        'runner dispersal should record recentDispersal totals for runner',
      );
      assert.equal(runnerMetrics.totalDormantSeeds, 0, 'runner dispersal should not add dormant seeds');
    },
  );
}

function configureToleranceSweepGrid(state) {
  for (const tile of state.tiles) {
    tile.waterType = null;
    tile.rockType = null;
    tile.plantIds = [];
    tile.dormantSeeds = {};

    const nx = state.width <= 1 ? 0 : tile.x / (state.width - 1);
    const ny = state.height <= 1 ? 0 : tile.y / (state.height - 1);

    tile.ph = 4.8 + nx * 3.4;
    tile.fertility = nx;
    tile.moisture = 1 - ny;
    tile.baseShade = ny;
    tile.shade = tile.baseShade;

    if (nx < 0.25) {
      tile.drainage = 'poor';
    } else if (nx < 0.5) {
      tile.drainage = 'moderate';
    } else if (nx < 0.75) {
      tile.drainage = 'well';
    } else {
      tile.drainage = 'excellent';
    }
  }
}

function speciesSummary(state) {
  const metrics = getMetrics(state);
  return Object.entries(metrics.speciesCounts)
    .map(([id, count]) => `${id}:${count}`)
    .join('|');
}

function withSpeciesDispersalOverride(speciesId, overrides, run) {
  const species = PLANT_BY_ID[speciesId];
  const original = JSON.parse(JSON.stringify(species.dispersal));
  species.dispersal = { ...species.dispersal, ...overrides };
  try {
    return run(species);
  } finally {
    species.dispersal = original;
  }
}

function createSinglePlantDispersalState(seed, speciesId, x = 24, y = 24) {
  const state = createInitialGameState(seed, { width: 50, height: 50 });
  state.dayOfYear = 26;
  state.plants = {};
  state.nextPlantNumericId = 2;

  for (const tile of state.tiles) {
    tile.plantIds = [];
    tile.dormantSeeds = {};
    tile.rockType = null;
  }

  const plantId = `test_${speciesId}`;
  state.plants[plantId] = {
    id: plantId,
    speciesId,
    age: PLANT_BY_ID[speciesId].ageOfMaturity + 3,
    x,
    y,
    stageName: 'first_year_vegetative',
    alive: true,
    vitality: 1,
    source: 'founder',
  };
  state.tiles[y * state.width + x].plantIds = [plantId];
  return state;
}

function collectDormantSeedPositions(state, speciesId) {
  const positions = [];
  for (const tile of state.tiles) {
    const seedEntry = tile.dormantSeeds[speciesId];
    if (seedEntry) {
      positions.push({ x: tile.x, y: tile.y, waterType: tile.waterType });
    }
  }
  return positions;
}

function maxManhattanDistance(positions, originX, originY) {
  if (positions.length === 0) {
    return 0;
  }
  return Math.max(...positions.map((pos) => Math.abs(pos.x - originX) + Math.abs(pos.y - originY)));
}

function runSpeciesReproductionNicheSweepTest() {
  const speciesIds = ['daucus_carota', 'juglans_nigra', 'urtica_dioica'];

  for (const [speciesOffset, speciesId] of speciesIds.entries()) {
    const species = PLANT_BY_ID[speciesId];

    const deathState = createInitialGameState(8000 + speciesOffset, { width: 12, height: 12 });
    configureToleranceSweepGrid(deathState);
    seedSpeciesEverywhere(deathState, speciesId, 0, 'founder');
    const postStress = advanceDay(deathState, 1);

    let outOfRangeEarlyCount = 0;
    let outOfRangeEarlyVitalityTotal = 0;
    for (const tile of postStress.tiles) {
      if (tile.plantIds.length === 0) {
        continue;
      }
      const plant = postStress.plants[tile.plantIds[0]];
      const withinTolerance = tileInSpeciesTolerance(tile, species);
      if (withinTolerance) {
        assert.ok(
          plant.vitality > 0,
          `in-range plant should remain viable for ${speciesId} at (${tile.x},${tile.y})`,
        );
      } else {
        assert.ok(
          plant.vitality < 1,
          `out-of-range plant should lose vitality for ${speciesId} at (${tile.x},${tile.y})`,
        );
        outOfRangeEarlyCount += 1;
        outOfRangeEarlyVitalityTotal += plant.vitality;
      }
    }

    const postLongStress = advanceDay(deathState, 45);
    let outOfRangeStressCount = 0;
    let outOfRangeStressVitalityTotal = 0;
    for (const tile of postLongStress.tiles) {
      if (tile.plantIds.length === 0) {
        continue;
      }
      const plant = postLongStress.plants[tile.plantIds[0]];
      if (!plant) {
        continue;
      }

      if (!tileInSpeciesTolerance(tile, species)) {
        outOfRangeStressCount += 1;
        outOfRangeStressVitalityTotal += plant.vitality;
      }
    }

    assert.ok(outOfRangeEarlyCount > 0, `expected early out-of-range sample for ${speciesId}`);
    if (outOfRangeStressCount > 0) {
      const outOfRangeEarlyAvgVitality = outOfRangeEarlyVitalityTotal / outOfRangeEarlyCount;
      const outOfRangeAvgVitality = outOfRangeStressVitalityTotal / outOfRangeStressCount;
      assert.equal(
        outOfRangeAvgVitality < outOfRangeEarlyAvgVitality,
        true,
        `out-of-range plants should continue losing vitality under sustained stress for ${speciesId}`,
      );
    } else {
      assert.equal(
        species.longevity === 'perennial',
        false,
        `only non-perennials should fully die off in out-of-range stress sweep for ${speciesId}`,
      );
    }

    const germState = createInitialGameState(9000 + speciesOffset, { width: 12, height: 12 });
    configureToleranceSweepGrid(germState);
    germState.plants = {};
    for (const tile of germState.tiles) {
      tile.plantIds = [];
      tile.disturbed = true;
      tile.dormantSeeds[speciesId] = { ageDays: 0 };
    }

    const postGerm = advanceDay(germState, 8);
    let inRangeSurvivors = 0;
    let outOfRangeSurvivors = 0;

    for (const tile of postGerm.tiles) {
      const hasSeedling = tile.plantIds.some((plantId) => postGerm.plants[plantId]?.speciesId === speciesId);
      if (!hasSeedling) {
        continue;
      }
      if (tileInSpeciesTolerance(tile, species)) {
        inRangeSurvivors += 1;
      } else {
        outOfRangeSurvivors += 1;
      }
    }

    assert.equal(
      outOfRangeSurvivors,
      0,
      `out-of-range survivors found for ${speciesId} after environmental death checks`,
    );
    assert.ok(inRangeSurvivors > 0, `expected in-range surviving population for ${speciesId} in sweep test`);
  }
}

function runDeterminismTest() {
  const a = createInitialGameState(4242, { width: 60, height: 60 });
  const b = createInitialGameState(4242, { width: 60, height: 60 });

  assert.equal(speciesSummary(a), speciesSummary(b), 'same seed should produce same founder counts');

  const aAdvanced = advanceDay(a, 80);
  const bAdvanced = advanceDay(b, 80);

  assert.equal(
    JSON.stringify(getMetrics(aAdvanced)),
    JSON.stringify(getMetrics(bAdvanced)),
    'same seed + same day steps should be deterministic',
  );
}

function runAdvanceDayInputImmutabilityTest() {
  const state = createInitialGameState(2027, { width: 40, height: 40 });
  const samplePlant = Object.values(state.plants).find((plant) => plant.speciesId === 'daucus_carota')
    || Object.values(state.plants)[0];
  assert.ok(samplePlant, 'expected at least one plant in initial state for immutability test');

  const dayBefore = state.dayOfYear;
  const totalBefore = state.totalDaysSimulated;
  const ageBefore = samplePlant.age;
  const tileIndexBefore = samplePlant.y * state.width + samplePlant.x;
  const tilePlantIdsBefore = [...state.tiles[tileIndexBefore].plantIds];

  const advanced = advanceDay(state, 1);
  assert.ok(advanced !== state, 'advanceDay should return a new state object');

  assert.equal(state.dayOfYear, dayBefore, 'advanceDay should not mutate source dayOfYear');
  assert.equal(
    state.totalDaysSimulated,
    totalBefore,
    'advanceDay should not mutate source totalDaysSimulated',
  );
  assert.equal(
    state.plants[samplePlant.id].age,
    ageBefore,
    'advanceDay should not mutate source plant ages',
  );
  assert.equal(
    JSON.stringify(state.tiles[tileIndexBefore].plantIds),
    JSON.stringify(tilePlantIdsBefore),
    'advanceDay should not mutate source tile occupancy arrays',
  );
}

function runMapSanityTest() {
  const state = createInitialGameState(10000, { width: 70, height: 70 });
  const center = getTileAt(state, Math.floor(state.width / 2), Math.floor(state.height / 2));
  assert.ok(center, 'center tile should exist');

  const waterTiles = state.tiles.filter((tile) => tile.waterType).length;
  assert.ok(waterTiles > 0, 'map should contain water tiles');

  const rockTiles = state.tiles.filter((tile) => tile.rockType);
  assert.ok(rockTiles.length > 0, 'map should contain rock tiles');

  const flintTiles = rockTiles.filter((tile) => tile.rockType === 'flint_cobble_scatter');
  const erraticTiles = rockTiles.filter((tile) => tile.rockType === 'glacial_erratic');
  assert.ok(erraticTiles.length > 0, 'map should include at least one glacial erratic tile');
  assert.ok(flintTiles.length > 0, 'map should include at least one flint cobble scatter tile');

  const rockOnWater = state.tiles.find((tile) => tile.rockType && tile.waterType);
  assert.equal(rockOnWater, undefined, 'rock tiles should never be placed on water tiles');

  const rockWithPlant = state.tiles.find((tile) => tile.rockType && tile.plantIds.length > 0);
  assert.equal(rockWithPlant, undefined, 'rock tiles should not host plant occupancy at map start');

  const invalidMoisture = state.tiles.find((tile) => tile.moisture < 0 || tile.moisture > 1);
  assert.equal(invalidMoisture, undefined, 'all moisture values should be clamped 0..1');

  const invalidPermeability = state.tiles.find((tile) => tile.permeability < 0 || tile.permeability > 1);
  assert.equal(invalidPermeability, undefined, 'all permeability values should be clamped 0..1');

  const riverTiles = state.tiles.filter((tile) => tile.waterType === 'river');
  assert.ok(riverTiles.length > 0, 'map should include moving river tiles');
  assert.ok(
    riverTiles.some((tile) => tile.x === 0 || tile.y === 0 || tile.x === state.width - 1 || tile.y === state.height - 1),
    'generated river system should include at least one edge-connected water tile',
  );
  for (const tile of riverTiles) {
    assert.ok(
      Number.isFinite(tile.waterCurrentStrength) && tile.waterCurrentStrength >= 0 && tile.waterCurrentStrength <= 1,
      'river tile current strength should be normalized 0..1',
    );
    assert.ok(
      tile.waterCurrentBand === 'slow' || tile.waterCurrentBand === 'medium' || tile.waterCurrentBand === 'fast',
      'river tile current band should be one of slow|medium|fast',
    );
  }

  const invalidFertility = state.tiles.find((tile) => tile.fertility < 0 || tile.fertility > 1);
  assert.equal(invalidFertility, undefined, 'fertility should stay normalized 0..1');

  const invalidSoilMatch = state.tiles.find((tile) => tile.maxSoilMatch < 0 || tile.maxSoilMatch > 1);
  assert.equal(invalidSoilMatch, undefined, 'soil match score should stay normalized 0..1');

  const landTiles = state.tiles.filter((tile) => !tile.waterType);
  const disturbedLandTiles = landTiles.filter((tile) => tile.disturbed === true).length;
  assert.ok(disturbedLandTiles > 0, 'map should include some disturbed land tiles for pioneer germination');
  assert.ok(
    disturbedLandTiles < landTiles.length,
    'map should not mark all land tiles as disturbed',
  );

  const wetSampleSize = Math.max(20, Math.floor(landTiles.length * 0.15));
  const wetSlice = [...landTiles]
    .sort((a, b) => b.moisture - a.moisture)
    .slice(0, wetSampleSize);
  const wetDrainageClasses = new Set(wetSlice.map((tile) => tile.drainage));
  assert.ok(
    wetDrainageClasses.has('poor') || wetDrainageClasses.has('moderate'),
    'wet zones should include lower-drainage classes',
  );
  assert.ok(
    wetDrainageClasses.has('well') || wetDrainageClasses.has('excellent'),
    'wet zones should include better-drained patches (drainage decoupled from moisture)',
  );

  const overCapacityTile = state.tiles.find((tile) => tile.plantIds.length > 1);
  assert.equal(overCapacityTile, undefined, 'tile occupancy should never exceed 1 plant');
}

function runAdvanceDayCalendarTest() {
  const state = createInitialGameState(99, { width: 50, height: 50 });
  const start = getMetrics(state);

  const next = advanceDay(state, 40);
  const end = getMetrics(next);

  assert.equal(start.year + 1, end.year, '40 days should advance exactly one year');
  assert.equal(end.dayOfYear, start.dayOfYear, 'dayOfYear should wrap after full year');
  assert.equal(end.totalDaysSimulated, start.totalDaysSimulated + 40, 'total day counter should increase');
}

function expectedTemperatureBand(tempF) {
  if (tempF < 25) {
    return 'freezing';
  }
  if (tempF <= 40) {
    return 'cold';
  }
  if (tempF <= 55) {
    return 'cool';
  }
  if (tempF <= 75) {
    return 'mild';
  }
  if (tempF <= 85) {
    return 'warm';
  }
  return 'hot';
}

function runDailyWeatherSignalTest() {
  let state = createInitialGameState(12345, { width: 40, height: 40 });
  const metrics = getMetrics(state);

  assert.ok(Number.isFinite(metrics.dailyTemperatureF), 'initial metrics should include daily temperature value');
  assert.equal(
    metrics.dailyTemperatureBand,
    expectedTemperatureBand(metrics.dailyTemperatureF),
    'initial metrics should include a temperature band consistent with daily temperature',
  );
  assert.ok(metrics.dailyWindVector && typeof metrics.dailyWindVector === 'object', 'initial metrics should include daily wind vector');
  assert.ok(
    Number.isFinite(metrics.dailyWindVector.strength)
      && metrics.dailyWindVector.strength >= 0
      && metrics.dailyWindVector.strength <= 1,
    'daily wind strength should remain normalized 0..1',
  );

  const seenBands = new Set([metrics.dailyTemperatureBand]);
  let previousVariance = Number(state.weatherTemperatureVarianceF);

  for (let day = 0; day < 60; day += 1) {
    state = advanceDay(state, 1);
    const dayMetrics = getMetrics(state);
    seenBands.add(dayMetrics.dailyTemperatureBand);

    const variance = Number(state.weatherTemperatureVarianceF);
    assert.ok(Number.isFinite(variance), 'temperature variance offset should stay finite');
    assert.ok(variance >= -6 && variance <= 6, 'temperature variance offset should be clamped to [-6, +6]');
    assert.ok(
      Math.abs(variance - previousVariance) <= 3.0001,
      'daily temperature variance drift should not exceed +/-3F per day',
    );
    previousVariance = variance;

    const wind = dayMetrics.dailyWindVector;
    assert.ok(Number.isFinite(wind.x) && Number.isFinite(wind.y), 'daily wind vector should have numeric x/y');
    assert.ok(
      Number.isFinite(wind.strength) && wind.strength >= 0 && wind.strength <= 1,
      'daily wind vector strength should stay normalized',
    );
    assert.ok(
      Number.isFinite(wind.angleRadians),
      'daily wind vector should expose direction angle in radians',
    );
    assert.equal(
      dayMetrics.dailyTemperatureBand,
      expectedTemperatureBand(dayMetrics.dailyTemperatureF),
      'temperature band should match the current daily temperature',
    );
  }

  assert.ok(seenBands.size >= 2, 'weather progression should traverse at least two temperature bands over 60 days');
}

function runDailyWeatherSnapshotRoundTripTest() {
  const initial = createInitialGameState(91234, { width: 40, height: 40 });
  const advanced = advanceDay(initial, 17);
  const payload = serializeGameState(advanced);
  const loaded = deserializeGameState(payload);

  assert.equal(
    loaded.dailyTemperatureF,
    advanced.dailyTemperatureF,
    'snapshot round-trip should preserve daily temperature',
  );
  assert.equal(
    loaded.dailyTemperatureBand,
    advanced.dailyTemperatureBand,
    'snapshot round-trip should preserve daily temperature band',
  );
  assert.equal(
    JSON.stringify(loaded.dailyWindVector),
    JSON.stringify(advanced.dailyWindVector),
    'snapshot round-trip should preserve daily wind vector',
  );
  assert.equal(
    loaded.weatherTemperatureVarianceF,
    advanced.weatherTemperatureVarianceF,
    'snapshot round-trip should preserve weather temperature variance drift state',
  );
  assert.equal(
    loaded.consecutiveFreezingDays,
    advanced.consecutiveFreezingDays,
    'snapshot round-trip should preserve freezing streak counter',
  );
}

function runWaterFreezingRulesTest() {
  const state = createInitialGameState(12001, { width: 20, height: 20 });

  for (const tile of state.tiles) {
    tile.waterType = null;
    tile.waterDepth = null;
    tile.waterFrozen = false;
    tile.rockType = null;
  }

  const pondTile = state.tiles[5 * state.width + 5];
  pondTile.waterType = 'pond';
  pondTile.waterDepth = 'deep';

  const riverTile = state.tiles[5 * state.width + 6];
  riverTile.waterType = 'river';
  riverTile.waterDepth = 'deep';
  riverTile.waterCurrentStrength = 0.5;
  riverTile.waterCurrentBand = 'medium';

  state.dailyTemperatureBand = 'freezing';
  state.dailyTemperatureF = 20;
  state.consecutiveFreezingDays = 0;

  const day1 = advanceDay(state, 1);
  const day1Pond = day1.tiles[pondTile.y * day1.width + pondTile.x];
  const day1River = day1.tiles[riverTile.y * day1.width + riverTile.x];

  assert.equal(day1.consecutiveFreezingDays, 1, 'first freezing day should increment freeze streak to 1');
  assert.equal(day1Pond.waterFrozen, false, 'pond should remain unfrozen after first freezing day');
  assert.equal(day1River.waterFrozen, false, 'river should remain unfrozen after first freezing day');

  day1.dailyTemperatureBand = 'freezing';
  day1.dailyTemperatureF = 18;

  const day2 = advanceDay(day1, 1);
  const day2Pond = day2.tiles[pondTile.y * day2.width + pondTile.x];
  const day2River = day2.tiles[riverTile.y * day2.width + riverTile.x];

  assert.equal(day2.consecutiveFreezingDays, 2, 'second freezing day should increment freeze streak to 2');
  assert.equal(day2Pond.waterFrozen, true, 'pond should freeze after two consecutive freezing days');
  assert.equal(day2River.waterFrozen, false, 'river should remain liquid even after freezing streak');

  day2.dailyTemperatureBand = 'mild';
  day2.dailyTemperatureF = 60;

  const thawed = advanceDay(day2, 1);
  const thawedPond = thawed.tiles[pondTile.y * thawed.width + pondTile.x];

  assert.equal(thawed.consecutiveFreezingDays, 0, 'freeze streak should reset once temperature rises above freezing');
  assert.equal(thawedPond.waterFrozen, false, 'pond should thaw when day temperature is above freezing');
}

function runFounderCoverageTest() {
  const state = createInitialGameState(2026, { width: 80, height: 80 });
  const metrics = getMetrics(state);

  for (const speciesId of Object.keys(metrics.speciesCounts)) {
    const species = PLANT_BY_ID[speciesId];
    const hasStrictViableTile = state.tiles.some((tile) => {
      if (tile.waterType) {
        return false;
      }
      return tileInSpeciesTolerance(tile, species);
    });

    if (hasStrictViableTile) {
      assert.ok(
        metrics.speciesCounts[speciesId] > 0,
        `founder placement should include species ${speciesId} when viable strict niche exists`,
      );
    }
  }
}

function runSeedLifecycleTest() {
  const initial = createInitialGameState(10000, { width: 80, height: 80 });
  const afterFall = advanceDay(initial, 30);
  const fallMetrics = getMetrics(afterFall);

  assert.ok(fallMetrics.totalDormantSeeds > 0, 'seed dispersal should populate dormant seed pools by fall');

  const afterSpring = advanceDay(afterFall, 40);
  const seededPlants = Object.values(afterSpring.plants).filter((plant) => plant.source === 'seed').length;

  assert.ok(seededPlants > 0, 'germination should create seed-sourced plant instances by following spring');

  const overCapacityTile = afterSpring.tiles.find((tile) => tile.plantIds.length > 1);
  assert.equal(overCapacityTile, undefined, 'seed lifecycle should still respect one plant per tile');
}

function runDynamicShadeTest() {
  const state = createInitialGameState(7777, { width: 50, height: 50 });
  const advanced = advanceDay(state, 30);

  const invalidShade = advanced.tiles.find((tile) => tile.shade < 0 || tile.shade > 1);
  assert.equal(invalidShade, undefined, 'dynamic shade should stay normalized 0..1');

  const invalidEffectiveShade = advanced.tiles.find((tile) => {
    if (!Number.isFinite(tile.effectiveShadeForOccupant)) {
      return false;
    }
    return tile.effectiveShadeForOccupant < 0 || tile.effectiveShadeForOccupant > tile.shade;
  });
  assert.equal(
    invalidEffectiveShade,
    undefined,
    'effective shade for occupant should be normalized and never exceed raw tile shade',
  );

  const largeTreeTile = advanced.tiles.find((tile) => {
    if (tile.plantIds.length === 0) {
      return false;
    }
    const plant = advanced.plants[tile.plantIds[0]];
    return plant && plant.speciesId === 'juglans_nigra';
  });

  if (largeTreeTile && Number.isFinite(largeTreeTile.effectiveShadeForOccupant)) {
    assert.ok(
      largeTreeTile.effectiveShadeForOccupant <= 0.6,
      'very large trees should cap own-tile effective shade for future stress/death checks',
    );
  }
}

function runIncompatibleSnapshotRejectionTest() {
  const state = createInitialGameState(10000, { width: 40, height: 40 });
  const firstTile = state.tiles.find((tile) => !tile.waterType);
  assert.ok(firstTile, 'requires at least one non-water tile for snapshot compatibility test');

  const invalidSnapshot = {
    ...state,
    tiles: state.tiles.map((tile) => ({ ...tile, plantIds: [...tile.plantIds] })),
  };

  invalidSnapshot.tiles[firstTile.y * invalidSnapshot.width + firstTile.x].plantIds = ['fake_1', 'fake_2'];

  assert.throws(
    () => deserializeGameState(invalidSnapshot),
    /Incompatible snapshot: tile contains multiple plants/,
    'loader should reject legacy multi-plant tile snapshots',
  );
}

function runRockSnapshotRoundTripTest() {
  const state = createInitialGameState(44004, { width: 50, height: 50 });
  const rockBefore = state.tiles
    .filter((tile) => tile.rockType)
    .map((tile) => `${tile.x},${tile.y}:${tile.rockType}`)
    .sort()
    .join('|');
  assert.ok(rockBefore.length > 0, 'snapshot test precondition: expected generated rock tiles');

  const payload = serializeGameState(state);
  const loaded = deserializeGameState(payload);
  const rockAfter = loaded.tiles
    .filter((tile) => tile.rockType)
    .map((tile) => `${tile.x},${tile.y}:${tile.rockType}`)
    .sort()
    .join('|');

  assert.equal(rockAfter, rockBefore, 'snapshot round-trip should preserve rock tile assignments');
}

function runMoveBlockedByRockTileTest() {
  const state = createInitialGameState(9011, { width: 30, height: 30 });
  const player = state.actors.player;
  const startTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(startTile, 'test requires land start tile for move blocked rock checks');
  const rockTarget = findAdjacentTileMatching(state, startTile, (tile) => tile && !tile.waterType);
  assert.ok(rockTarget, 'test requires adjacent tile for move blocked rock checks');

  rockTarget.rockType = 'glacial_erratic';
  player.x = startTile.x;
  player.y = startTile.y;
  const dx = rockTarget.x - startTile.x;
  const dy = rockTarget.y - startTile.y;

  const validation = validateAction(state, {
    actorId: 'player',
    kind: 'move',
    payload: { dx, dy },
  });
  assert.equal(validation.ok, false, 'move should reject destination rock tile');
  assert.equal(validation.code, 'move_blocked_tile', 'rock movement should reject with move_blocked_tile');

  const advanced = advanceTick(state, {
    actions: [
      {
        actionId: 'move-to-rock',
        actorId: 'player',
        kind: 'move',
        payload: { dx, dy },
      },
    ],
  });
  assert.equal(advanced.actors.player.x, startTile.x, 'move runtime should not relocate actor onto rock');
  assert.equal(advanced.actors.player.y, startTile.y, 'move runtime should not relocate actor onto rock');
}

function runCarrotRootSubStageLifecycleFilteringTest() {
  const state = createInitialGameState(9012, { width: 30, height: 30 });
  const hostTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(hostTile, 'test requires host tile for carrot sub-stage lifecycle checks');
  const plantId = 'test-carrot-biennial';

  state.plants[plantId] = {
    id: plantId,
    speciesId: 'daucus_carota',
    x: hostTile.x,
    y: hostTile.y,
    alive: true,
    age: 3,
    stageName: 'first_year_vegetative',
    activeSubStages: [],
    vitality: 1,
  };
  hostTile.plantIds = [plantId];

  const advanced = advanceDay(state, 1);
  const plant = advanced.plants[plantId];
  assert.ok(plant, 'carrot plant should remain alive after one-day advance');
  const rootSubStages = Array.isArray(plant.activeSubStages)
    ? plant.activeSubStages
      .filter((entry) => entry?.partName === 'root')
      .map((entry) => entry.subStageId)
    : [];
  assert.ok(rootSubStages.includes('first_year'), 'first-year carrot should expose first_year root sub-stage');
  assert.equal(rootSubStages.includes('second_year'), false, 'first-year carrot must not expose second_year root sub-stage');
}

function runLogFungusHarvestValidationAndRuntimeTest() {
  const state = createInitialGameState(9013, { width: 30, height: 30 });
  const player = state.actors.player;
  const playerTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  assert.ok(playerTile, 'test requires player land tile for log fungus harvest checks');
  const logTile = findAdjacentTileMatching(state, playerTile, (tile) => tile && !tile.waterType && !tile.rockType);
  assert.ok(logTile, 'test requires adjacent dead-log tile for log fungus harvest checks');
  player.x = playerTile.x;
  player.y = playerTile.y;

  logTile.deadLog = {
    sourceSpeciesId: 'test_tree',
    sizeAtDeath: 'medium',
    decayStage: 2,
    fungi: [
      {
        species_id: 'pleurotus_ostreatus',
        yield_current_grams: 120,
        fruiting_windows: [],
        rolled_year_by_window: {},
      },
    ],
  };

  const validation = validateAction(state, {
    actorId: 'player',
    kind: 'harvest',
    payload: { x: logTile.x, y: logTile.y },
  });
  assert.equal(validation.ok, true, 'harvest should validate for fruiting log fungus');
  assert.equal(validation.normalizedAction.payload.targetType, 'log_fungus', 'fruiting dead log should normalize as log_fungus harvest target');

  const harvested = advanceTick(state, {
    actions: [
      {
        actionId: 'harvest-log-fungus',
        actorId: 'player',
        kind: 'harvest',
        payload: { x: logTile.x, y: logTile.y },
      },
    ],
  });

  const fungusStack = harvested.actors.player.inventory.stacks.find((entry) => entry.itemId === 'log_fungus:pleurotus_ostreatus:fruiting_body');
  assert.ok(fungusStack, 'log fungus harvest should add fruiting body item to inventory');
  assert.ok(Number(fungusStack.quantity) > 0, 'log fungus harvest should add positive quantity');
  const remainingYield = Number(harvested.tiles.find((tile) => tile.x === logTile.x && tile.y === logTile.y)?.deadLog?.fungi?.[0]?.yield_current_grams || 0);
  assert.equal(remainingYield, 0, 'log fungus harvest should consume current fruiting yield');
}

function runExtractedInventoryModuleSmokeTest() {
  assert.equal(
    normalizeStackFootprintValueImpl(undefined),
    1,
    'extracted inventory helper should default missing footprint to 1',
  );
  assert.equal(
    normalizeStackFootprintValueImpl(3),
    3,
    'extracted inventory helper should preserve valid integer footprints',
  );
  assert.equal(
    normalizeStackFootprintValueImpl(0),
    1,
    'extracted inventory helper should clamp non-positive footprints to 1',
  );
}

function addMockMedicinePlant(state, speciesId = 'juglans_nigra') {
  const tile = state.tiles.find((candidate) => !candidate.waterType && !candidate.rockType);
  assert.ok(tile, 'test precondition: expected at least one dry land tile for mock medicine plant');
  const plantId = `test_medicine_${speciesId}`;
  state.plants[plantId] = {
    id: plantId,
    speciesId,
    age: 20,
    x: tile.x,
    y: tile.y,
    stageName: 'mature_vegetative',
    alive: true,
    vitality: 1,
    activeSubStages: [
      {
        partName: 'bark',
        subStageId: 'rough',
        regrowthCountdown: null,
        harvestsThisSeason: 0,
      },
    ],
    source: 'test',
  };
  if (!Array.isArray(tile.plantIds)) {
    tile.plantIds = [];
  }
  tile.plantIds.push(plantId);
}

function runDebriefMedicineAutoTreatmentTest() {
  const state = createInitialGameState(5511, { width: 30, height: 30 });
  const player = state.actors.player;
  player.x = state.camp.anchorX;
  player.y = state.camp.anchorY;
  state.dayTick = 220;
  player.conditions = [
    {
      condition_id: 'gut_illness',
      instance_id: 'gut_illness_auto_1',
      treated: false,
      treatable_by: ['tannin_tea'],
    },
  ];
  state.camp.stockpile.stacks = [
    {
      itemId: 'juglans_nigra:bark:rough',
      quantity: 1,
    },
  ];
  addMockMedicinePlant(state, 'juglans_nigra');

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'debrief-enter-auto-treat',
        actorId: 'player',
        kind: 'debrief_enter',
        payload: {},
      },
    ],
  });

  assert.equal(next.camp.debrief.active, true, 'debrief_enter should activate debrief state');
  assert.equal(next.actors.player.conditions[0].treated, true, 'debrief medicine pass should mark condition as treated');
  assert.equal(next.camp.debrief.medicineRequests.length, 0, 'auto-treated condition should not remain in request list');
  assert.equal(next.camp.debrief.medicineNotifications.length, 1, 'auto-treated condition should emit one medicine notification');
  assert.equal(
    Math.floor(Number(next.camp.stockpile.stacks.find((entry) => entry.itemId === 'juglans_nigra:bark:rough')?.quantity || 0)),
    0,
    'auto treatment should consume requested medicine ingredient from stockpile',
  );
}

function runDebriefMedicineRequestDetailsTest() {
  const state = createInitialGameState(5512, { width: 30, height: 30 });
  const player = state.actors.player;
  player.x = state.camp.anchorX;
  player.y = state.camp.anchorY;
  state.dayTick = 220;
  player.conditions = [
    {
      condition_id: 'gut_illness',
      instance_id: 'gut_illness_request_1',
      treated: false,
      treatable_by: ['tannin_tea'],
    },
  ];
  state.camp.stockpile.stacks = [];
  addMockMedicinePlant(state, 'juglans_nigra');

  const next = advanceTick(state, {
    actions: [
      {
        actionId: 'debrief-enter-request',
        actorId: 'player',
        kind: 'debrief_enter',
        payload: {},
      },
    ],
  });

  assert.equal(next.actors.player.conditions[0].treated, false, 'missing stockpile medicine should keep condition untreated');
  assert.equal(next.camp.debrief.medicineNotifications.length, 0, 'request branch should not emit treatment notification');
  assert.equal(next.camp.debrief.medicineRequests.length, 1, 'missing stockpile medicine should emit one partner request');

  const request = next.camp.debrief.medicineRequests[0];
  assert.equal(request.speciesId, 'juglans_nigra', 'medicine request should expose the required plant species');
  assert.equal(request.partName, 'bark', 'medicine request should expose the required plant part');
  assert.equal(request.subStageId, 'rough', 'medicine request should expose the required sub-part stage');
  assert.equal(request.quantity, 1, 'medicine request should expose required quantity');
}

function runDebriefMedicineActionGatingTest() {
  const state = createInitialGameState(5513, { width: 30, height: 30 });
  const player = state.actors.player;
  player.x = state.camp.anchorX;
  player.y = state.camp.anchorY;
  state.dayTick = 220;
  player.conditions = [
    {
      condition_id: 'gut_illness',
      instance_id: 'gut_illness_gate_1',
      treated: false,
      treatable_by: ['tannin_tea'],
    },
  ];
  addMockMedicinePlant(state, 'juglans_nigra');

  const blocked = validateAction(state, {
    actorId: 'player',
    kind: 'partner_medicine_administer',
    payload: { conditionInstanceId: 'gut_illness_gate_1' },
  });
  assert.equal(blocked.ok, false, 'partner_medicine_administer should be rejected outside debrief');
  assert.equal(blocked.code, 'medicine_not_in_debrief', 'outside-debrief medicine action should report medicine_not_in_debrief');

  const activeDebrief = advanceTick(state, {
    actions: [
      {
        actionId: 'debrief-enter-gate',
        actorId: 'player',
        kind: 'debrief_enter',
        payload: {},
      },
    ],
  });
  const allowed = validateAction(activeDebrief, {
    actorId: 'player',
    kind: 'partner_medicine_administer',
    payload: { conditionInstanceId: 'gut_illness_gate_1' },
  });
  assert.equal(allowed.ok, true, 'partner_medicine_administer should validate once debrief is active');
}

function runDebriefVisionRequestAndCooldownTest() {
  const state = createInitialGameState(5514, { width: 30, height: 30 });
  const player = state.actors.player;
  player.x = state.camp.anchorX;
  player.y = state.camp.anchorY;
  state.dayTick = 220;
  const fungusDefinition = GROUND_FUNGUS_BY_ID.amanita_bisporigera || null;
  const previousIngestion = fungusDefinition?.ingestion || null;
  if (fungusDefinition) {
    fungusDefinition.ingestion = {
      vision_item: { quantity_per_dose: 1 },
      dose_response: [
        {
          effects: [
            {
              type: 'hallucinogen',
              partner_prep_required: true,
              vision_categories: ['sight', 'tech'],
              sight_duration_days: 5,
            },
          ],
        },
      ],
    };
  }

  try {
    const fungusTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
    assert.ok(fungusTile, 'vision test requires at least one dry land tile for mock fungus zone');
    fungusTile.groundFungusZone = {
      type: 'ground_fungus_zone',
      speciesId: 'amanita_bisporigera',
      annualFruitChance: 1,
      fruitingWindows: [],
      perTileYieldRange: [20, 20],
      yieldCurrentGrams: 20,
    };

    const entered = advanceTick(state, {
      actions: [
        {
          actionId: 'debrief-enter-vision',
          actorId: 'player',
          kind: 'debrief_enter',
          payload: {},
        },
      ],
    });
    assert.equal(entered.camp.debrief.active, true, 'debrief should be active before requesting vision');

    const requestOnly = advanceTick(entered, {
      actions: [
        {
          actionId: 'vision-request-missing-stockpile',
          actorId: 'player',
          kind: 'partner_vision_request',
          payload: {},
        },
      ],
    });
    assert.ok(requestOnly.camp.debrief.visionRequest, 'vision request should be created when ingredient is missing');
    assert.equal(requestOnly.camp.debrief.visionUsesThisSeason, 0, 'missing ingredient should not consume seasonal vision count');
    assert.equal(requestOnly.camp.debrief.visionRequest.quantity, 1, 'vision request should include required quantity');
    assert.equal(requestOnly.camp.debrief.visionRequest.partName, 'fruiting_body', 'vision request should expose required mushroom part');

    requestOnly.camp.stockpile.stacks = [{ itemId: 'amanita_bisporigera:fruiting_body:whole', quantity: 2 }];
    const consumedFirst = advanceTick(requestOnly, {
      actions: [
        {
          actionId: 'vision-request-consume-1',
          actorId: 'player',
          kind: 'partner_vision_request',
          payload: {},
        },
      ],
    });
    assert.equal(consumedFirst.camp.debrief.visionUsesThisSeason, 0, 'vision request should not consume until player confirmation');
    assert.equal(consumedFirst.camp.debrief.visionRequest, null, 'stockpile path should not create missing-ingredient request');
    assert.equal(consumedFirst.camp.debrief.requiresVisionConfirmation, true, 'vision request should require confirmation when stockpile options exist');
    assert.ok(
      Array.isArray(consumedFirst.camp.debrief.visionSelectionOptions)
        && consumedFirst.camp.debrief.visionSelectionOptions.length >= 1,
      'vision request should list selectable stockpile hallucinogens',
    );

    const confirmFirst = advanceTick(consumedFirst, {
      actions: [
        {
          actionId: 'vision-confirm-consume-1',
          actorId: 'player',
          kind: 'partner_vision_confirm',
          payload: { itemId: 'amanita_bisporigera:fruiting_body:whole' },
        },
      ],
    });
    assert.equal(confirmFirst.camp.debrief.visionUsesThisSeason, 1, 'vision confirmation should consume one seasonal use');
    assert.ok(confirmFirst.camp.debrief.pendingVisionRevelation, 'vision confirmation should create pending revelation');
    assert.ok(
      Array.isArray(confirmFirst.camp.debrief.pendingVisionChoices)
        && confirmFirst.camp.debrief.pendingVisionChoices.some((entry) => entry.category === 'sight'),
      'pending revelation should include sight category choice',
    );

    const chosenFirst = advanceTick(confirmFirst, {
      actions: [
        {
          actionId: 'vision-choose-sight-1',
          actorId: 'player',
          kind: 'partner_vision_choose',
          payload: { category: 'sight' },
        },
      ],
    });
    assert.equal(
      Math.floor(Number(chosenFirst.actors.player.natureSightPendingDays) || 0),
      5,
      'choosing sight should queue nature sight duration from ingestion data',
    );
    assert.equal(
      Math.floor(Number(chosenFirst.actors.player.visionNextDayTickPenalty) || 0),
      50,
      'successful vision should queue 50 next-day tick penalty',
    );

    const consumedSecond = advanceTick(chosenFirst, {
      actions: [
        {
          actionId: 'vision-request-consume-2',
          actorId: 'player',
          kind: 'partner_vision_request',
          payload: {},
        },
      ],
    });
    assert.equal(consumedSecond.camp.debrief.requiresVisionConfirmation, true, 'second request should also require confirmation');

    const confirmSecond = advanceTick(consumedSecond, {
      actions: [
        {
          actionId: 'vision-confirm-consume-2',
          actorId: 'player',
          kind: 'partner_vision_confirm',
          payload: { itemId: 'amanita_bisporigera:fruiting_body:whole' },
        },
      ],
    });
    assert.equal(confirmSecond.camp.debrief.visionUsesThisSeason, 2, 'two successful vision confirmations should reach seasonal cap');
    assert.ok(confirmSecond.camp.debrief.pendingVisionRevelation, 'second successful vision should again create pending revelation');

    const chosenSecond = advanceTick(confirmSecond, {
      actions: [
        {
          actionId: 'vision-choose-tech-2',
          actorId: 'player',
          kind: 'partner_vision_choose',
          payload: { category: 'tech' },
        },
      ],
    });
    assert.equal(
      Math.floor(Number(chosenSecond.actors.player.visionRewardCounts.tech) || 0),
      1,
      'choosing tech should increment tech revelation counter',
    );

    const cooldownValidation = validateAction(chosenSecond, {
      actorId: 'player',
      kind: 'partner_vision_request',
      payload: {},
    });
    assert.equal(cooldownValidation.ok, false, 'vision request should be blocked at seasonal cap');
    assert.equal(cooldownValidation.code, 'vision_cooldown_active', 'vision cap should report vision_cooldown_active');

    const rolloverBase = deserializeGameState(serializeGameState(chosenSecond));
    rolloverBase.dayTick = 399;
    const rolled = advanceTick(rolloverBase, { idleTicks: 1 });
    assert.equal(
      Math.floor(Number(rolled.actors.player.tickBudgetCurrent) || 0),
      100,
      'two visions should apply cumulative 100 tick next-day penalty at rollover',
    );
    assert.equal(
      Math.floor(Number(rolled.actors.player.natureSightDaysRemaining) || 0),
      5,
      'nature sight pending duration should activate at day rollover',
    );

    const overlaySet = advanceTick(rolled, {
      actions: [
        {
          actionId: 'set-nature-sight-overlay',
          actorId: 'player',
          kind: 'nature_sight_overlay_set',
          payload: { overlay: 'mushroom_zones' },
        },
      ],
    });
    assert.equal(
      overlaySet.actors.player.natureSightOverlayChoice,
      'mushroom_zones',
      'active nature sight should allow setting an overlay choice',
    );
    const lockedValidation = validateAction(overlaySet, {
      actorId: 'player',
      kind: 'nature_sight_overlay_set',
      payload: { overlay: 'animal_density' },
    });
    assert.equal(lockedValidation.ok, false, 'nature sight overlay should lock after one selection in a day');
    assert.equal(lockedValidation.code, 'nature_sight_overlay_locked_for_day', 'locked overlay switch should return dedicated lock code');

    const sameOverlayValidation = validateAction(overlaySet, {
      actorId: 'player',
      kind: 'nature_sight_overlay_set',
      payload: { overlay: 'mushroom_zones' },
    });
    assert.equal(sameOverlayValidation.ok, true, 're-selecting same overlay in same day should be allowed');

    const overlayContract = getNatureSightOverlayOptions();
    assert.deepEqual(
      overlayContract,
      ['calorie_heatmap', 'animal_density', 'mushroom_zones', 'plant_compatibility', 'fishing_hotspots'],
      'nature sight overlay options should match agreed contract',
    );

    const overlayData = getNatureSightOverlayData(overlaySet, { actorId: 'player', overlay: 'calorie_heatmap' });
    assert.equal(overlayData.active, true, 'overlay data should be available while nature sight is active');
    assert.equal(overlayData.overlay, 'calorie_heatmap', 'overlay data should honor requested overlay key');
    assert.ok(Object.keys(overlayData.valuesByTile).length > 0, 'overlay data should expose per-tile values');
    assert.ok(
      Number.isFinite(overlayData.minValue) && Number.isFinite(overlayData.maxValue),
      'overlay data should include finite min/max bounds',
    );

    const selectedAnimalSpeciesId = Object.values(ANIMAL_BY_ID).find((entry) => entry?.animalClass !== 'fish')?.id;
    assert.ok(selectedAnimalSpeciesId, 'overlay test requires at least one non-fish animal species');
    const animalOverlay = getNatureSightOverlayData(overlaySet, {
      actorId: 'player',
      overlay: 'animal_density',
      selectedAnimalSpeciesId,
    });
    assert.equal(
      animalOverlay.selectedAnimalSpeciesId,
      selectedAnimalSpeciesId,
      'animal density overlay should track selected species only',
    );

    const selectedFishSpeciesId = Object.values(ANIMAL_BY_ID).find((entry) => entry?.animalClass === 'fish')?.id;
    assert.ok(selectedFishSpeciesId, 'overlay test requires at least one fish species');
    const fishOverlay = getNatureSightOverlayData(overlaySet, {
      actorId: 'player',
      overlay: 'fishing_hotspots',
      selectedFishSpeciesId,
    });
    assert.equal(
      fishOverlay.selectedFishSpeciesId,
      selectedFishSpeciesId,
      'fishing hotspots overlay should track selected fish species only',
    );

    const nextDayForOverlay = deserializeGameState(serializeGameState(overlaySet));
    nextDayForOverlay.dayTick = 399;
    const overlayDay2 = advanceTick(nextDayForOverlay, { idleTicks: 1 });
    const day2Validation = validateAction(overlayDay2, {
      actorId: 'player',
      kind: 'nature_sight_overlay_set',
      payload: { overlay: 'animal_density' },
    });
    assert.equal(day2Validation.ok, true, 'overlay lock should reset on next day while sight remains active');
  } finally {
    if (fungusDefinition) {
      fungusDefinition.ingestion = previousIngestion;
    }
  }
}

function main() {
  const tests = [
    ['extracted inventory module smoke', runExtractedInventoryModuleSmokeTest],
    ['determinism', runDeterminismTest],
    ['advanceDay input immutability', runAdvanceDayInputImmutabilityTest],
    ['advanceTick determinism', runAdvanceTickDeterminismTest],
    ['action stream replay equivalence', runActionStreamReplayEquivalenceTest],
    ['action unlock gate', runActionUnlockGateTest],
    ['parameterized recipe unlock gate', runParameterizedRecipeUnlockGateTest],
    ['camp station and tool craft core effects', runCampStationAndToolCraftCoreEffectsTest],
    ['harvest reach-tier tool requirements', runHarvestReachTierToolRequirementsTest],
    ['harvest legacy remainingActions migration', runHarvestLegacyRemainingActionsMigrationTest],
    ['raised sleeping platform comfort budget bonus', runRaisedSleepingPlatformComfortBudgetBonusTest],
    ['windbreak reflector wall partner budget bonus', runWindbreakReflectorWallPartnerBudgetBonusTest],
    ['workbench tool craft tick reduction', runWorkbenchToolCraftTickReductionTest],
    ['carved wooden spout knife requirement', runCarvedWoodenSpoutKnifeRequirementTest],
    ['carved wooden spout runtime preserves knife', runCarvedWoodenSpoutCraftRuntimePreservesKnifeTest],
    ['bone_hook craft validation and runtime', runBoneHookCraftValidationAndRuntimeTest],
    ['sun_hat craft validation and runtime', runSunHatCraftValidationAndRuntimeTest],
    ['reedy material craft alias support', runReedyMaterialCraftAliasSupportTest],
    ['leaching basket place/retrieve progression', runLeachingBasketPlaceRetrieveAndProgressionTest],
    ['workbench carved wooden spout tick reduction', runWorkbenchSpoutCraftTickReductionTest],
    ['tap insert spout validation rules', runTapInsertSpoutValidationRulesTest],
    ['tap insert spout invalid target tile', runTapInsertSpoutInvalidTargetTileTest],
    ['tap insert spout runtime and budget', runTapInsertSpoutRuntimeAndBudgetTest],
    ['tap insert spout adjacent and out-of-range', runTapInsertSpoutAdjacentAndOutOfRangeTest],
    ['tap remove spout validation rules', runTapRemoveSpoutValidationRulesTest],
    ['tap remove spout out-of-range', runTapRemoveSpoutOutOfRangeTest],
    ['tap remove spout runtime and budget', runTapRemoveSpoutRuntimeAndBudgetTest],
    ['tap place vessel validation rules', runTapPlaceVesselValidationRulesTest],
    ['tap place vessel out-of-range', runTapPlaceVesselOutOfRangeTest],
    ['tap place vessel runtime and budget', runTapPlaceVesselRuntimeAndBudgetTest],
    ['tap retrieve vessel validation rules', runTapRetrieveVesselValidationRulesTest],
    ['tap retrieve vessel out-of-range', runTapRetrieveVesselOutOfRangeTest],
    ['tap retrieve vessel runtime and budget', runTapRetrieveVesselRuntimeAndBudgetTest],
    ['item pickup validation rules', runItemPickupValidationRulesTest],
    ['item pickup runtime transfer', runItemPickupRuntimeTransferTest],
    ['item drop validation rules', runItemDropValidationRulesTest],
    ['item drop runtime transfer', runItemDropRuntimeTransferTest],
    ['item drop no wet dry merge single stack tile', runItemDropNoWetDryMergeSingleStackTileTest],
    ['sap tap daily fill progression', runSapTapDailyFillProgressionTest],
    ['sap tap daily fill guards', runSapTapDailyFillGuardsTest],
    ['sap tap daily fill capacity clamp', runSapTapDailyFillCapacityClampTest],
    ['dig adjacent and out-of-range validation', runDigAdjacentAndOutOfRangeValidationTest],
    ['hoe adjacent and out-of-range validation', runHoeAdjacentAndOutOfRangeValidationTest],
    ['inspect adjacent and out-of-range validation', runInspectAdjacentAndOutOfRangeValidationTest],
    ['harvest cache adjacent and out-of-range validation', runHarvestCacheAdjacentAndOutOfRangeValidationTest],
    ['harvest plantId range unchanged', runHarvestPlantIdRangeUnchangedTest],
    ['harvest rock materials from boulders', runHarvestRockMaterialsFromBouldersTest],
    ['trap place snare validation rules', runTrapPlaceSnareValidationRulesTest],
    ['trap place snare runtime and daily resolution', runTrapPlaceSnareRuntimeAndDailyResolutionTest],
    ['trap place deadfall validation rules', runTrapPlaceDeadfallValidationRulesTest],
    ['trap place deadfall runtime and daily resolution', runTrapPlaceDeadfallRuntimeAndDailyResolutionTest],
    ['trap place fish weir validation rules', runTrapPlaceFishWeirValidationRulesTest],
    ['trap place fish weir runtime and daily resolution', runTrapPlaceFishWeirRuntimeAndDailyResolutionTest],
    ['fish rod cast validation rules', runFishRodCastValidationRulesTest],
    ['fish rod cast early-stop and density behavior', runFishRodCastEarlyStopAndDensityBehaviorTest],
    ['fish rod cast snap semantics', runFishRodCastSnapSemanticsTest],
    ['auto rod place and trap_check lifecycle', runAutoRodPlaceAndTrapCheckLifecycleTest],
    ['trap place snare poach chance scaling', runTrapPlaceSnarePoachChanceScalingTest],
    ['trap tiles block plant germination on tile', runTrapTilesBlockPlantGerminationOnTileTest],
    ['trap check retrieves carcass and resets snare', runTrapCheckRetrievesCarcassAndResetsSnareTest],
    ['trap check retrieves deadfall carcass and resets trap', runTrapCheckRetrievesDeadfallCarcassAndResetsTrapTest],
    ['trap check retrieves fish carcass and resets fish trap', runTrapCheckRetrievesFishCarcassAndResetsFishTrapTest],
    ['carcass butcher requires knife and yields subparts', runCarcassButcherRequiresKnifeAndYieldsSubpartsTest],
    ['fell tree validation rules', runFellTreeValidationRulesTest],
    ['fell tree runtime and pole yield', runFellTreeRuntimeAndPoleYieldTest],
    ['sap tap snapshot round-trip', runSapTapSnapshotRoundTripTest],
    ['auto rod snapshot round-trip', runAutoRodSnapshotRoundTripTest],
    ['thread spinner partner task tick reduction', runThreadSpinnerPartnerTaskTickReductionTest],
    ['intermediate item registry consistency', runIntermediateItemRegistryConsistencyTest],
    ['hide frame partner task station requirement', runHideFramePartnerTaskStationRequirementTest],
    ['mortar pestle partner task station requirement', runMortarPestlePartnerTaskStationRequirementTest],
    ['sugar boiling partner task station requirement', runSugarBoilingPartnerTaskStationRequirementTest],
    ['process item hand catalog pipeline', runProcessItemHandCatalogPipelineTest],
    ['process item station requirement pipeline', runProcessItemStationRequirementPipelineTest],
    ['process item boil sap filled vessel pipeline', runProcessItemBoilSapFilledVesselPipelineTest],
    ['process item boil sap not partner restricted', runProcessItemBoilSapNotPartnerRestrictedTest],
    ['interrupted player process_item resume', runInterruptedPlayerProcessItemResumeTest],
    ['interrupted player tool_craft resume', runInterruptedPlayerToolCraftResumeTest],
    ['interrupted player camp_station_build resume', runInterruptedPlayerCampStationBuildResumeTest],
    ['interrupted player dig resume', runInterruptedPlayerDigResumeTest],
    ['drying rack and ground drying progression', runDryingRackAndGroundDryingProgressionTest],
    ['advanceTick input immutability', runAdvanceTickInputImmutabilityTest],
    ['advanceTick invalid action rejection', runAdvanceTickInvalidActionRejectionTest],
    ['getAllActions smoke', runGetAllActionsSmokeTest],
    ['advanceTick budget gate', runAdvanceTickBudgetGateTest],
    ['advanceTick full-cost overdraft', runAdvanceTickFullCostOverdraftTest],
    ['action tick-cost preview', runActionTickCostPreviewTest],
    ['partner task set validation', runPartnerTaskSetValidationTest],
    ['tech research partner task unlock', runTechResearchPartnerTaskUnlockTest],
    ['partner task continuous progression', runPartnerTaskContinuousProgressionTest],
    ['partner task queue policy and output stacking', runPartnerTaskQueuePolicyAndOutputStackingTest],
    ['partner task straddles day boundary', runPartnerTaskStraddlesDayBoundaryTest],
    ['partner task invalidates on missing inputs', runPartnerTaskInvalidatesOnMissingInputsTest],
    ['inspect and dig core effects', runInspectAndDigCoreEffectsTest],
    ['eat and harvest core effects', runEatAndHarvestCoreEffectsTest],
    ['eat field-edibility threshold validation', runEatFieldEdibilityThresholdValidationTest],
    ['equip and unequip actions', runEquipUnequipActionsTest],
    ['equipped gloves harvest injury behavior', runEquippedGlovesHarvestInjuryBehaviorTest],
    ['equipped coat harvest injury behavior', runEquippedCoatHarvestInjuryBehaviorTest],
    ['equipment snapshot round-trip', runEquipmentSnapshotRoundTripTest],
    ['coat cold exposure per-tick behavior', runCoatColdExposurePerTickTest],
    ['temperature thirst drain and sun hat modifier', runTemperatureThirstDrainAndSunHatModifierTest],
    ['fish carcass not field edible and no clean processing', runFishCarcassNotFieldEdibleAndNoCleanProcessTest],
    ['dig earthworm spawn and frozen block', runDigEarthwormSpawnAndFrozenBlockTest],
    ['earthworm ground decay escapes', runEarthwormGroundDecayEscapesTest],
    ['axe harvest modifier applies', runAxeHarvestModifierAppliesTest],
    ['axe knife harvest modifier precedence', runAxeKnifeHarvestModifierPrecedenceTest],
    ['eat filled sap vessel returns empty container', runEatFilledSapVesselReturnsEmptyContainerTest],
    ['waterskin fill and drink validation', runWaterskinFillAndDrinkValidationTest],
    ['waterskin fill/drink runtime and gut illness', runWaterskinFillDrinkRuntimeAndGutIllnessTest],
    ['debrief medicine auto treatment', runDebriefMedicineAutoTreatmentTest],
    ['debrief medicine request details', runDebriefMedicineRequestDetailsTest],
    ['debrief medicine action gating', runDebriefMedicineActionGatingTest],
    ['debrief vision request and cooldown', runDebriefVisionRequestAndCooldownTest],
    ['camp stockpile camp bounds validation', runCampStockpileCampBoundsValidationTest],
    ['camp stockpile transfer actions', runCampStockpileTransferActionsTest],
    ['no implicit dry wet stack merge', runNoImplicitDryWetStackMergeTest],
    ['inventory auto reorder for pickup', runInventoryAutoReorderForPickupTest],
    ['stockpile withdraw leaves remainder when inventory full', runStockpileWithdrawLeavesRemainderWhenInventoryFullTest],
    ['daily item decay across containers', runDailyItemDecayAcrossContainersTest],
    ['dig squirrel cache interruption', runDigSquirrelCacheInterruptionTest],
    ['digging stick validation tick reduction', runDiggingStickValidationTickReductionTest],
    ['digging stick cache interruption precedence', runDiggingStickCacheInterruptionPrecedenceTest],
    ['digging stick advanceTick budget consumption', runDiggingStickAdvanceTickBudgetConsumptionTest],
    ['shovel validation tick reduction', runShovelValidationTickReductionTest],
    ['shovel precedence over digging stick', runShovelPrecedenceOverDiggingStickTest],
    ['shovel cache discovery tick normalization', runShovelCacheDiscoveryTickNormalizationTest],
    ['shovel advanceTick budget consumption', runShovelAdvanceTickBudgetConsumptionTest],
    ['dig underground plant part flow', runDigUndergroundPlantPartFlowTest],
    ['carrot harvest scaled unit weight by age', runCarrotHarvestScaledUnitWeightTest],
    ['hoe validation and tick cost', runHoeValidationAndTickCostTest],
    ['hoe blocked tile rules', runHoeBlockedTileRulesTest],
    ['hoe runtime effects', runHoeRuntimeEffectsTest],
    ['hoe advanceTick budget consumption', runHoeAdvanceTickBudgetConsumptionTest],
    ['dig shallow water allowed', runDigShallowWaterAllowedTest],
    ['discovered squirrel cache harvest', runDiscoveredSquirrelCacheHarvestTest],
    ['map sanity', runMapSanityTest],
    ['water flood-fill pond classification', runWaterFloodFillPondClassificationTest],
    ['calendar advance', runAdvanceDayCalendarTest],
    ['daily weather signal', runDailyWeatherSignalTest],
    ['daily weather snapshot round-trip', runDailyWeatherSnapshotRoundTripTest],
    ['water freezing rules', runWaterFreezingRulesTest],
    ['founder coverage', runFounderCoverageTest],
    ['seed 10000 founder mix regression', runSeed10000FounderMixRegressionTest],
    ['initial dead tree generation', runInitialDeadTreeGenerationTest],
    ['phantom occupancy cleanup', runPhantomOccupancyCleanupTest],
    ['seed lifecycle', runSeedLifecycleTest],
    ['dispersal mechanisms', runDispersalMechanismsTest],
    ['dynamic shade', runDynamicShadeTest],
    ['disturbance-aware germination', runDisturbanceAwareGerminationTest],
    ['vitality stress and recovery', runVitalityStressAndRecoveryTest],
    ['perennial winter mortality amortized', runPerennialWinterMortalityAmortizedTest],
    ['dead log creation on tree death', runDeadLogCreationOnTreeDeathTest],
    ['active sub-stage lifecycle', runActiveSubStageLifecycleTest],
    ['biennial stage exhaustion death', runBiennialStageExhaustionDeathTest],
    ['incremental harvest vitality damage', runIncrementalHarvestVitalityDamageTest],
    ['regrowth seasonal vitality budget', runRegrowthSeasonalBudgetVitalityTest],
    ['no unsuitable seedling germination', runNoUnsuitableSeedlingGerminationTest],
    ['species reproduction niche sweep', runSpeciesReproductionNicheSweepTest],
    ['animal zone generation gate and permanence', runAnimalZoneGenerationGateAndPermanenceTest],
    ['animal zone snapshot round-trip', runAnimalZoneSnapshotRoundTripTest],
    ['animal density signal bias', runAnimalDensitySignalBiasTest],
    ['fish population generation gate and permanence', runFishPopulationGenerationGateAndPermanenceTest],
    ['fish population snapshot round-trip', runFishPopulationSnapshotRoundTripTest],
    ['fish population recovery toward equilibrium', runFishPopulationRecoveryTowardEquilibriumTest],
    ['fish density determinism and variance', runFishDensityDeterminismAndVarianceTest],
    ['fish density habitat signal', runFishDensityHabitatSignalTest],
    ['ground fungus zone generation gate and permanence', runGroundFungusZoneGenerationGateAndPermanenceTest],
    ['ground fungus fruiting blocked reassignment', runGroundFungusFruitingBlockedReassignmentTest],
    ['ground fungus snapshot round-trip', runGroundFungusSnapshotRoundTripTest],
    ['beehive generation gate, placement, and seasonal behavior', runBeehiveGenerationGatePlacementAndSeasonalBehaviorTest],
    ['squirrel cache generation, placement, and yearly refill', runSquirrelCacheGenerationPlacementAndYearlyRefillTest],
    ['squirrel cache generation uses squirrel density modeling', runSquirrelCacheGenerationUsesSquirrelDensityModelingTest],
    ['beehive and squirrel cache snapshot round-trip', runBeehiveAndSquirrelCacheSnapshotRoundTripTest],
    ['log fungus yearly colonization', runLogFungusYearlyColonizationTest],
    ['log fungus fruiting window reset', runLogFungusFruitingWindowResetTest],
    ['snapshot compatibility guard', runIncompatibleSnapshotRejectionTest],
    ['rock snapshot round-trip', runRockSnapshotRoundTripTest],
    ['move blocked by rock tile', runMoveBlockedByRockTileTest],
    ['carrot root lifecycle sub-stage filtering', runCarrotRootSubStageLifecycleFilteringTest],
    ['log fungus harvest validation and runtime', runLogFungusHarvestValidationAndRuntimeTest],
  ];

  const started = Date.now();
  const timingResults = [];
  for (const [name, testFn] of tests) {
    const testStartNs = process.hrtime.bigint();
    testFn();
    const elapsedMs = Number(process.hrtime.bigint() - testStartNs) / 1e6;
    timingResults.push({ name, elapsedMs });
    console.log(`PASS ${name}`);
  }
  const totalMs = Date.now() - started;
  const slowestResults = [...timingResults]
    .sort((a, b) => b.elapsedMs - a.elapsedMs)
    .slice(0, 10);

  console.log('Slowest sim tests (top 10):');
  for (const entry of slowestResults) {
    console.log(`  ${entry.elapsedMs.toFixed(1)}ms  ${entry.name}`);
  }

  console.log(`All sim tests passed in ${totalMs}ms`);
}

main();
