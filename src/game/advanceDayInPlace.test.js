import { createInitialGameState, advanceDay, advanceDayInPlace, advanceDayPure } from './simCore.mjs';

describe('advanceDayInPlace', () => {
  test('mutates input state object (unlike advanceDay)', () => {
    const base = createInitialGameState(12345, { width: 30, height: 30 });
    const beforeDays = base.totalDaysSimulated;

    const nextPure = advanceDayPure(base, 1);
    expect(nextPure).not.toBe(base);
    expect(base.totalDaysSimulated).toBe(beforeDays);

    const nextMut = advanceDayInPlace(base, 1);
    expect(nextMut).toBe(base);
    expect(base.totalDaysSimulated).toBe(beforeDays + 1);
  });
});

