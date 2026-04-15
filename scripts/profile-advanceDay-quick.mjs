// Short advanceDay run for CPU profiling (see package / node --cpu-prof).
import { createInitialGameState, advanceDay } from '../src/game/simCore.mjs';

function parseArgInt(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((a) => typeof a === 'string' && a.startsWith(prefix));
  if (!raw) {
    return fallback;
  }
  const n = Number(raw.slice(prefix.length));
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

const SEED = parseArgInt('seed', 424242);
const WIDTH = parseArgInt('width', 80);
const HEIGHT = parseArgInt('height', 80);
const DAYS = parseArgInt('days', 50);
const WARMUP_DAYS = parseArgInt('warmupDays', Math.min(10, Math.floor(DAYS / 10)));

let state = createInitialGameState(SEED, { width: WIDTH, height: HEIGHT });
for (let i = 0; i < WARMUP_DAYS; i += 1) {
  state = advanceDay(state, 1);
}
for (let i = 0; i < DAYS; i += 1) {
  state = advanceDay(state, 1);
}

console.log(JSON.stringify({
  profileAdvanceDayQuick: true,
  seed: SEED,
  width: WIDTH,
  height: HEIGHT,
  warmupDays: WARMUP_DAYS,
  simulatedDays: DAYS,
  totalDaysSimulated: state.totalDaysSimulated,
}));
