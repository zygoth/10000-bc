import { runActionQueue } from './actionRunner.mjs';
import { advanceOneTickImpl } from './tickSystems.mjs';

export function buildAdvanceOneTick(hooks) {
  return function advanceOneTick(state) {
    return advanceOneTickImpl(state, hooks);
  };
}

export function advanceTickImpl(state, options = {}, hooks) {
  let nextState = hooks.advanceDay(state, 0);
  hooks.ensureTickSystems(nextState);
  return runActionQueue(nextState, options, {
    ...hooks,
    advanceOneTick: buildAdvanceOneTick(hooks),
  });
}
