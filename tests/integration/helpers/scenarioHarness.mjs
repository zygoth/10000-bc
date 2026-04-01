import assert from 'node:assert/strict';
import { advanceDay, advanceTick, validateAction } from '../../../src/game/simCore.mjs';
import { startPlayerGame } from '../../../src/game/startPlayerGame.mjs';
import { loadFixtureDocument } from './fixtureLoader.mjs';

export function createScenarioState(options = {}) {
  const fixtureName = typeof options.fixtureName === 'string' && options.fixtureName
    ? options.fixtureName
    : 'golden-world.v1.json';
  const fixture = loadFixtureDocument(fixtureName);
  const started = startPlayerGame({
    fixture,
    campAnchor: options.campAnchor,
  });
  return started.state;
}

export function applyAction(state, action) {
  const result = validateAction(state, action);
  assert.equal(result.ok, true, `action should validate: ${action.kind} (${result.code || 'n/a'})`);
  return advanceTick(state, {
    actions: [
      {
        actionId: action.actionId || `${action.kind}-action`,
        ...action,
      },
    ],
  });
}

export function idleTicks(state, ticks) {
  const count = Math.max(0, Math.floor(Number(ticks) || 0));
  if (count === 0) {
    return state;
  }
  return advanceTick(state, { idleTicks: count });
}

export function advanceDays(state, days) {
  const count = Math.max(0, Math.floor(Number(days) || 0));
  if (count === 0) {
    return state;
  }
  return advanceDay(state, count);
}

export function findAdjacentTile(state, x, y, predicate = null) {
  const checks = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (const [dx, dy] of checks) {
    const tx = x + dx;
    const ty = y + dy;
    const tile = state.tiles.find((entry) => entry.x === tx && entry.y === ty);
    if (!tile) {
      continue;
    }
    if (!predicate || predicate(tile)) {
      return tile;
    }
  }
  return null;
}

