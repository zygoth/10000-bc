import {
  advanceDay,
  createInitialGameState,
  deserializeGameState,
  serializeGameState,
} from './simCore.mjs';
import { inBounds } from './simWorld.mjs';
import { applyFixtureMigrations, getLatestFixtureVersion } from './saveMigrations/index.mjs';

function cloneState(state) {
  return deserializeGameState(serializeGameState(state));
}

function parseCampAnchor(anchor, fallbackX, fallbackY, width, height) {
  const x = Number.isInteger(anchor?.x) ? anchor.x : fallbackX;
  const y = Number.isInteger(anchor?.y) ? anchor.y : fallbackY;
  if (!inBounds(x, y, width, height)) {
    return { x: fallbackX, y: fallbackY };
  }
  return { x, y };
}

function ensureActorsAtCamp(state, campX, campY) {
  if (!state.actors || typeof state.actors !== 'object') {
    state.actors = {};
  }

  const fallbackActors = createInitialGameState(state.seed || 10000, {
    width: state.width,
    height: state.height,
  }).actors;

  if (!state.actors.player || typeof state.actors.player !== 'object') {
    state.actors.player = JSON.parse(JSON.stringify(fallbackActors.player));
  }
  if (!state.actors.partner || typeof state.actors.partner !== 'object') {
    state.actors.partner = JSON.parse(JSON.stringify(fallbackActors.partner));
  }

  state.actors.player.x = campX;
  state.actors.player.y = campY;
  state.actors.partner.x = campX;
  state.actors.partner.y = campY;
}

function normalizeStateFromFixture(fixtureInput) {
  const migrated = applyFixtureMigrations(fixtureInput, {
    targetVersion: getLatestFixtureVersion(),
  });
  return {
    fixtureMeta: {
      fixtureId: migrated.fixtureId,
      fixtureVersion: migrated.fixtureVersion,
      schemaVersion: migrated.schemaVersion,
      source: migrated.source,
    },
    state: cloneState(migrated.state),
  };
}

export function startPlayerGame(options = {}) {
  const fixture = options.fixture && typeof options.fixture === 'object' ? options.fixture : null;
  const seed = Number.isFinite(options.seed) ? Math.abs(Math.floor(options.seed)) : 10000;
  const width = Number.isInteger(options.width) ? options.width : 40;
  const height = Number.isInteger(options.height) ? options.height : 40;
  const prehistoryYears = Number.isInteger(options.prehistoryYears) ? Math.max(0, options.prehistoryYears) : 0;
  const enableWorldGeneration = options.enableWorldGeneration === true;

  let state;
  let fixtureMeta = null;

  if (fixture) {
    const normalized = normalizeStateFromFixture(fixture);
    state = normalized.state;
    fixtureMeta = normalized.fixtureMeta;
  } else {
    if (!enableWorldGeneration) {
      throw new Error('startPlayerGame requires a fixture unless enableWorldGeneration=true');
    }
    state = createInitialGameState(seed, { width, height });
    const totalDays = prehistoryYears * 365;
    for (let i = 0; i < totalDays; i += 1) {
      state = advanceDay(state, 1);
    }
  }

  const defaultCampX = Number.isInteger(state?.camp?.anchorX) ? state.camp.anchorX : Math.floor(state.width / 2);
  const defaultCampY = Number.isInteger(state?.camp?.anchorY) ? state.camp.anchorY : Math.floor(state.height / 2);
  const anchor = parseCampAnchor(options.campAnchor, defaultCampX, defaultCampY, state.width, state.height);
  state.camp.anchorX = anchor.x;
  state.camp.anchorY = anchor.y;
  ensureActorsAtCamp(state, anchor.x, anchor.y);

  return {
    state,
    fixtureMeta,
  };
}

