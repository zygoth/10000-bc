import { createInitialGameState, advanceTick, advanceDay } from './simCore.mjs';
import { TICKS_PER_DAY } from './simCore.constants.mjs';

function rackStack(overrides = {}) {
  return {
    itemId: 'juglans_nigra:walnut_meat:raw',
    quantity: 1,
    decayDaysRemaining: 100,
    footprintW: 1,
    footprintH: 1,
    dryness: 0,
    ...overrides,
  };
}

function buildDecayTestState(overrides = {}) {
  const state = createInitialGameState(4242, { width: 24, height: 24 });
  state.dailyTemperatureBand = 'mild';
  state.dailySunExposure = 1;
  state.dayTick = 0;
  state.camp.dryingRack.slots = [rackStack()];
  Object.assign(state, overrides);
  return state;
}

describe('item decay and drying (tick vs batch)', () => {
  it('ends the day with the same rack dryness after idle ticks vs one advanceDay; decay is near-parity', () => {
    const tickPath = buildDecayTestState();
    const afterTicks = advanceTick(tickPath, { idleTicks: TICKS_PER_DAY });

    const batchPath = buildDecayTestState();
    const afterBatch = advanceDay(batchPath, 1);

    const a = afterTicks.camp.dryingRack.slots[0];
    const b = afterBatch.camp.dryingRack.slots[0];
    // Full-day batch applies rack drying then one decay pass at elevated dryness; ticks interleave,
    // so decay totals can differ slightly while integrated drying matches.
    expect(Number(a.dryness) || 0).toBeCloseTo(Number(b.dryness) || 0, 5);
    expect(Math.abs(Number(a.decayDaysRemaining) - Number(b.decayDaysRemaining))).toBeLessThan(0.2);
  });

  it('suspends food decay in Freezing band for a full day', () => {
    const state = buildDecayTestState({ dailyTemperatureBand: 'freezing' });
    const next = advanceTick(state, { idleTicks: TICKS_PER_DAY });
    const slot = next.camp.dryingRack.slots[0];
    expect(slot.decayDaysRemaining).toBe(100);
    expect(Number(slot.dryness) || 0).toBe(0);
  });

  it('applies stronger decay in Hot than Mild for one batch day', () => {
    const mild = buildDecayTestState({ dailyTemperatureBand: 'mild' });
    const hot = buildDecayTestState({ dailyTemperatureBand: 'hot' });
    const mildNext = advanceDay(mild, 1);
    const hotNext = advanceDay(hot, 1);
    const mildDecay = mildNext.camp.dryingRack.slots[0].decayDaysRemaining;
    const hotDecay = hotNext.camp.dryingRack.slots[0].decayDaysRemaining;
    expect(hotDecay).toBeLessThan(mildDecay);
  });
});
