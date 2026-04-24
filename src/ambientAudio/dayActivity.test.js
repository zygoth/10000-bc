import { TICKS_PER_DAY } from '../game/simCore.constants.mjs';
import { resolveDayActivityFactor } from './dayActivity.mjs';

describe('resolveDayActivityFactor', () => {
  const entry = {
    day_activity: {
      kind: 'day_tick_segments',
      segments: [
        { from_tick: 0, to_tick: 100, relative: 0.2 },
        { from_tick: 100, to_tick: 400, relative: 1 },
      ],
    },
  };

  test('picks segment by dayTick', () => {
    expect(resolveDayActivityFactor(entry, 0)).toBe(0.2);
    expect(resolveDayActivityFactor(entry, 50)).toBe(0.2);
    expect(resolveDayActivityFactor(entry, 100)).toBe(1);
    expect(resolveDayActivityFactor(entry, 300)).toBe(1);
  });

  test('clamps dayTick to valid range', () => {
    expect(resolveDayActivityFactor(entry, TICKS_PER_DAY + 50)).toBe(1);
    expect(resolveDayActivityFactor(entry, -5)).toBe(0.2);
  });

  test('defaults to 1 when no segments', () => {
    expect(resolveDayActivityFactor({}, 200)).toBe(1);
  });
});
