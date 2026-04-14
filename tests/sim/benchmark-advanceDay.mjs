// advanceDay CPU benchmark — run plain: node tests/sim/benchmark-advanceDay.mjs
// Profile: node --cpu-prof --cpu-prof-name advanceDay-bench tests/sim/benchmark-advanceDay.mjs

import { createInitialGameState, advanceDay } from '../../src/game/simCore.mjs';

const SEED = 424242;
const WIDTH = 80;
const HEIGHT = 80;
const WARMUP_DAYS = 5;
const BENCH_DAYS = 120;

let state = createInitialGameState(SEED, { width: WIDTH, height: HEIGHT });

for (let i = 0; i < WARMUP_DAYS; i += 1) {
  state = advanceDay(state, 1);
}

const t0 = performance.now();
for (let i = 0; i < BENCH_DAYS; i += 1) {
  state = advanceDay(state, 1);
}
const ms = performance.now() - t0;

const plants = Object.keys(state.plants || {}).length;
console.log(
  JSON.stringify(
    {
      bench: 'advanceDay',
      map: `${WIDTH}x${HEIGHT}`,
      warmupDays: WARMUP_DAYS,
      benchDays: BENCH_DAYS,
      totalMs: Number(ms.toFixed(2)),
      msPerDay: Number((ms / BENCH_DAYS).toFixed(3)),
      plantCountEnd: plants,
      totalDaysSimulated: state.totalDaysSimulated,
    },
    null,
    2,
  ),
);
