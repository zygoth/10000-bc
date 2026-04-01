import assert from 'node:assert/strict';
import { getTileAt, validateAction } from '../../src/game/simCore.mjs';
import {
  advanceDays,
  applyAction,
  createScenarioState,
} from './helpers/scenarioHarness.mjs';

function moveActorTo(state, actorId, targetX, targetY) {
  let next = state;
  const actor = next.actors[actorId];
  let x = actor.x;
  let y = actor.y;
  while (x !== targetX || y !== targetY) {
    const dx = x === targetX ? 0 : (targetX > x ? 1 : -1);
    const dy = y === targetY ? 0 : (targetY > y ? 1 : -1);
    next = applyAction(next, {
      actorId,
      kind: 'move',
      payload: { dx, dy },
    });
    x = next.actors[actorId].x;
    y = next.actors[actorId].y;
  }
  return next;
}

function runFixedRouteLandmarkContractTest() {
  let state = createScenarioState();
  const routeTarget = { x: 0, y: 0 };
  const landmarkTile = getTileAt(state, routeTarget.x, routeTarget.y);
  assert.ok(landmarkTile, 'fixture route landmark tile should exist');
  assert.ok(
    Array.isArray(landmarkTile.plantIds) && landmarkTile.plantIds.length > 0,
    'fixture route landmark should contain at least one plant',
  );

  state = moveActorTo(state, 'player', routeTarget.x, routeTarget.y);
  const inspectValidation = validateAction(state, {
    actorId: 'player',
    kind: 'inspect',
    payload: { dx: 0, dy: 0 },
  });
  assert.equal(inspectValidation.ok, true, 'inspect should validate at fixed-route landmark');
}

function runMultiDayJourneySmokeTest() {
  let state = createScenarioState();
  const initialDay = state.totalDaysSimulated;
  const initialCampX = state.camp.anchorX;
  const initialCampY = state.camp.anchorY;
  state = advanceDays(state, 2);

  assert.equal(
    state.totalDaysSimulated,
    initialDay + 2,
    'journey scenario should advance world day counter deterministically',
  );
  assert.equal(state.camp.anchorX, initialCampX, 'camp anchor X should remain stable across day progression');
  assert.equal(state.camp.anchorY, initialCampY, 'camp anchor Y should remain stable across day progression');
}

export const INTEGRATION_TESTS = [
  ['fixed-route landmark contract', runFixedRouteLandmarkContractTest],
  ['multi-day journey smoke', runMultiDayJourneySmokeTest],
];

