import assert from 'node:assert/strict';
import { validateAction } from '../../src/game/simCore.mjs';
import {
  applyAction,
  createScenarioState,
  findAdjacentTile,
} from './helpers/scenarioHarness.mjs';
import {
  assertActorAt,
  assertActorHealthAtOrBelow,
  assertDeathEndsRun,
} from './helpers/assertions.mjs';

function runStartPlayerGameFixtureBootstrapTest() {
  const state = createScenarioState();
  const campX = state.camp.anchorX;
  const campY = state.camp.anchorY;

  assertActorAt(state, 'player', campX, campY, 'bootstrap actor camp placement');
  assertActorAt(state, 'partner', campX, campY, 'bootstrap actor camp placement');
  assert.equal(state.totalDaysSimulated, 9125, 'fixture should load canonical pre-simulated world age');
}

function runInventoryGridAndCarryWeightContractTest() {
  const state = createScenarioState();
  const inventory = state.actors.player.inventory;
  assert.equal(inventory.gridWidth, 6, 'player inventory grid width should remain 6');
  assert.equal(inventory.gridHeight, 4, 'player inventory grid height should remain 4');
  assert.equal(inventory.maxCarryWeightKg, 15, 'player carry limit should remain 15kg baseline');
}

function runMoveInspectDigEatSmokeTest() {
  let state = createScenarioState();
  const player = state.actors.player;
  const originX = player.x;
  const originY = player.y;

  const landNeighbor = findAdjacentTile(state, originX, originY, (tile) => !tile.waterType && !tile.rockType);
  assert.ok(landNeighbor, 'test requires a walkable adjacent tile');

  const dx = landNeighbor.x - originX;
  const dy = landNeighbor.y - originY;
  state = applyAction(state, {
    actorId: 'player',
    kind: 'move',
    payload: { dx, dy },
  });
  assertActorAt(state, 'player', landNeighbor.x, landNeighbor.y, 'move action');

  const inspectValidation = validateAction(state, {
    actorId: 'player',
    kind: 'inspect',
    payload: { dx: 0, dy: 0 },
  });
  assert.equal(inspectValidation.ok, true, 'inspect should validate at current location');

  const digValidation = validateAction(state, {
    actorId: 'player',
    kind: 'dig',
    payload: { dx: 0, dy: 0 },
  });
  assert.equal(digValidation.ok, true, 'dig should validate at current location');

  state.actors.player.hunger = 0.4;
  state.actors.player.inventory.stacks = [{ itemId: 'tree_sugar', quantity: 2 }];
  const beforeHunger = Number(state.actors.player.hunger) || 0;
  state = applyAction(state, {
    actorId: 'player',
    kind: 'eat',
    payload: { itemId: 'tree_sugar', quantity: 1 },
  });
  assert.ok((Number(state.actors.player.hunger) || 0) > beforeHunger, 'eat should increase hunger bar');
}

function runPlayerDeathTerminalInteractionTest() {
  const state = createScenarioState();
  state.actors.player.health = 0;

  const validation = validateAction(state, {
    actorId: 'player',
    kind: 'move',
    payload: { dx: 1, dy: 0 },
  });
  assert.equal(validation.ok, false, 'dead player should be unable to perform move');
  assert.equal(validation.code, 'actor_unavailable', 'dead player should resolve actor_unavailable');
  assertActorHealthAtOrBelow(state, 'player', 0, 'player death state');
  assertDeathEndsRun(state, 'player');
}

export const INTEGRATION_TESTS = [
  ['bootstrap fixture startPlayerGame', runStartPlayerGameFixtureBootstrapTest],
  ['player inventory grid and carry baseline', runInventoryGridAndCarryWeightContractTest],
  ['player move inspect dig eat smoke', runMoveInspectDigEatSmokeTest],
  ['player death terminal interaction gate', runPlayerDeathTerminalInteractionTest],
];

