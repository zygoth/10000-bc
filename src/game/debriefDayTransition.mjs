import { advanceTick } from './simCore.mjs';
import { TICKS_PER_DAY } from './simCore.constants.mjs';

/**
 * Fast-forward global day ticks to the next calendar morning (dayTick 0 after rollover).
 * Used by nightly debrief “Begin Day” and headless tests.
 */
export function advanceStateToNextMorning(state) {
  if (!state || typeof state !== 'object') {
    return state;
  }
  const dt = Math.max(0, Math.floor(Number(state.dayTick) || 0));
  const remain = TICKS_PER_DAY - dt;
  if (remain <= 0) {
    return state;
  }
  return advanceTick(state, { idleTicks: remain });
}
