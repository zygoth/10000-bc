jest.mock('./simCore.mjs', () => {
  const actual = jest.requireActual('./simCore.mjs');
  return {
    ...actual,
    advanceDay: (state, steps) => {
      const s = Number.isFinite(Number(steps)) ? Math.max(0, Math.floor(Number(steps))) : 0;
      state.totalDaysSimulated = (Number(state.totalDaysSimulated) || 0) + s;
      return state;
    },
  };
});

import { getTileAt } from './simCore.mjs';
import {
  DEFAULT_PREHISTORY_DAYS,
  DEFAULT_WORLD_START_HEIGHT,
  DEFAULT_WORLD_START_WIDTH,
  generateWorldStartState,
  selectCampAnchorNearWater,
} from './worldStart.mjs';

function footprintHasWater(state, anchorX, anchorY) {
  for (let oy = -1; oy <= 2; oy += 1) {
    for (let ox = -1; ox <= 2; ox += 1) {
      const tile = getTileAt(state, anchorX + ox, anchorY + oy);
      if (!tile || tile.waterType) {
        return true;
      }
    }
  }
  return false;
}

describe('worldStart', () => {
  test('selectCampAnchorNearWater picks a non-water 4x4 footprint near water', async () => {
    const state = await generateWorldStartState({ seed: 10000, prehistoryDays: 20 });
    const camp = selectCampAnchorNearWater(state, { maxWaterDistance: 10, randomSeed: 123 });
    expect(Number.isInteger(camp.x)).toBe(true);
    expect(Number.isInteger(camp.y)).toBe(true);
    expect(camp.nearestWaterDistance).toBeLessThanOrEqual(10);
    expect(footprintHasWater(state, camp.x, camp.y)).toBe(false);
  });

  test('generateWorldStartState uses 80x80 defaults and places actors at camp', async () => {
    const state = await generateWorldStartState({ seed: 10001, prehistoryDays: 40 });
    expect(state.width).toBe(DEFAULT_WORLD_START_WIDTH);
    expect(state.height).toBe(DEFAULT_WORLD_START_HEIGHT);
    expect(footprintHasWater(state, state.camp.anchorX, state.camp.anchorY)).toBe(false);
    expect(state.actors.player.x).toBe(state.camp.anchorX);
    expect(state.actors.player.y).toBe(state.camp.anchorY);
    expect(state.actors.partner.x).toBe(state.camp.anchorX);
    expect(state.actors.partner.y).toBe(state.camp.anchorY);
  });

  test('generateWorldStartState defaults to 1000 prehistory days', async () => {
    const state = await generateWorldStartState({ seed: 10002 });
    expect(state.totalDaysSimulated).toBe(DEFAULT_PREHISTORY_DAYS);
  });
});
