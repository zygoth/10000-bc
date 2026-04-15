import { advanceDayInPlace, advanceTick } from './simCore.mjs';

let _state = null;
let _version = 0;
const _listeners = new Set();

function emitRefresh(meta = null) {
  _version += 1;
  for (const listener of _listeners) {
    try {
      listener(meta);
    } catch (err) {
      // Listener errors should not break game progression.
      // Re-throw async so they still surface in dev.
      setTimeout(() => {
        throw err;
      }, 0);
    }
  }
}

export function getGameState() {
  return _state;
}

export function getGameStateVersion() {
  return _version;
}

export function subscribeToGameState(listener) {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

export function setGameState(nextState, meta = null) {
  _state = nextState;
  emitRefresh(meta || { kind: 'set' });
  return _state;
}

export function advanceTickAndEmit(options = {}) {
  if (!_state) {
    throw new Error('advanceTickAndEmit called before game state initialized');
  }
  _state = advanceTick(_state, options);
  emitRefresh({ kind: 'tick' });
  return _state;
}

export function advanceDayAndEmit(steps = 1, options = null) {
  if (!_state) {
    throw new Error('advanceDayAndEmit called before game state initialized');
  }
  const s = Number.isInteger(steps) ? steps : Math.floor(Number(steps) || 0);
  _state = options ? advanceDayInPlace(_state, s, options) : advanceDayInPlace(_state, s);
  emitRefresh({ kind: 'day', steps: s });
  return _state;
}

