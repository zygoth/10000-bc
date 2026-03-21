import { runDailyPlantStep } from './plants.mjs';
import { runDailyFungiStep } from './fungi.mjs';
import { runDailyTrapAndYieldStep } from './trapsAndYields.mjs';

export function runDailyStep(nextState, rng, hooks) {
  const {
    applyDailyWaterFreezeState,
    createEmptyRecentDispersal,
    rollDailyWeatherForCurrentDay,
  } = hooks;

  applyDailyWaterFreezeState(nextState);
  nextState.recentDispersal = createEmptyRecentDispersal(nextState.dayOfYear);
  runDailyPlantStep(nextState, rng, hooks);
  runDailyFungiStep(nextState, rng, hooks);
  runDailyTrapAndYieldStep(nextState, hooks);
  rollDailyWeatherForCurrentDay(nextState, rng);
}
