import assert from 'node:assert/strict';
import { validateAction } from '../../src/game/simCore.mjs';
import {
  advanceDays,
  applyAction,
  createScenarioState,
} from './helpers/scenarioHarness.mjs';

function runCampStockpileRoundTripTest() {
  let state = createScenarioState();
  state.actors.player.inventory.stacks = [
    {
      itemId: 'nuts',
      quantity: 4,
      freshness: 0.5,
      decayDaysRemaining: 6,
    },
  ];

  state = applyAction(state, {
    actorId: 'player',
    kind: 'camp_stockpile_add',
    payload: { itemId: 'nuts', quantity: 3 },
  });
  const inCamp = state.camp.stockpile.stacks.find((entry) => entry.itemId === 'nuts');
  assert.ok(inCamp, 'camp stockpile should contain transferred item');
  assert.equal(inCamp.quantity, 3, 'camp stockpile add should transfer requested quantity');

  state = applyAction(state, {
    actorId: 'player',
    kind: 'camp_stockpile_remove',
    payload: { itemId: 'nuts', quantity: 2 },
  });
  const inInventory = state.actors.player.inventory.stacks.find((entry) => entry.itemId === 'nuts');
  assert.ok(inInventory, 'inventory should receive stockpile transfer back');
  assert.equal(inInventory.quantity, 3, 'camp stockpile remove should add quantity back to player inventory');
}

function runGroundVsCampDecayProgressionTest() {
  let state = createScenarioState();
  const key = `${state.camp.anchorX},${state.camp.anchorY}`;
  state.worldItemsByTile[key] = [
    { itemId: 'earthworm', quantity: 1, decayDaysRemaining: 3, freshness: 0.7 },
  ];
  state.camp.stockpile.stacks = [
    { itemId: 'earthworm', quantity: 1, decayDaysRemaining: 3, freshness: 0.7 },
  ];

  state = advanceDays(state, 1);
  const worldDecay = Number(state.worldItemsByTile?.[key]?.[0]?.decayDaysRemaining);
  const stockDecay = Number(state.camp.stockpile.stacks?.[0]?.decayDaysRemaining);
  assert.ok(worldDecay <= 3, 'ground item decay should advance or hold, never increase');
  assert.ok(stockDecay <= 3, 'stockpile item decay should advance or hold, never increase');
}

function runCampStationBuildSmokeTest() {
  const state = createScenarioState();
  state.actors.player.inventory.stacks = [
    { itemId: 'pole', quantity: 4 },
    { itemId: 'cordage', quantity: 4 },
  ];
  state.techUnlocks = {
    ...(state.techUnlocks || {}),
    unlock_station_thread_spinner: true,
  };

  const validation = validateAction(state, {
    actorId: 'player',
    kind: 'camp_station_build',
    payload: { stationId: 'thread_spinner' },
  });
  assert.equal(validation.ok, true, 'thread spinner build should validate with materials and unlock');
}

function runToolActionGateSmokeTest() {
  const state = createScenarioState();
  const snareValidation = validateAction(state, {
    actorId: 'player',
    kind: 'trap_place_snare',
    payload: { dx: 0, dy: 0 },
  });
  assert.equal(snareValidation.ok, false, 'trap_place_snare should gate on missing tool');
  assert.equal(snareValidation.code, 'insufficient_item_quantity', 'trap_place_snare should report missing tool');

  const fishValidation = validateAction(state, {
    actorId: 'player',
    kind: 'fish_rod_cast',
    payload: { dx: 0, dy: 0 },
  });
  assert.equal(fishValidation.ok, false, 'fish_rod_cast should gate on missing fishing rod');
  assert.equal(fishValidation.code, 'insufficient_item_quantity', 'fish_rod_cast should report missing tool');
}

export const INTEGRATION_TESTS = [
  ['camp stockpile round-trip transfer', runCampStockpileRoundTripTest],
  ['ground vs camp decay progression', runGroundVsCampDecayProgressionTest],
  ['camp station build smoke', runCampStationBuildSmokeTest],
  ['tool action gate smoke', runToolActionGateSmokeTest],
];

