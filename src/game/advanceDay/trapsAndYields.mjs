export function runDailyTrapAndYieldStep(nextState, hooks) {
  const {
    applyBeehiveSeasonalState,
    applyFishPopulationRecovery,
    applyDailyItemDecay,
    applyDailySapTapFill,
    applyDailyLeachingBasketProgress,
    applyDailySimpleSnareResolution,
    applyDailyDeadfallTrapResolution,
    applyDailyFishTrapResolution,
    applyDailyAutoRodResolution,
  } = hooks;

  applyBeehiveSeasonalState(nextState);
  applyFishPopulationRecovery(nextState);
  applyDailyItemDecay(nextState);
  applyDailySapTapFill(nextState);
  applyDailyLeachingBasketProgress(nextState);
  applyDailySimpleSnareResolution(nextState);
  applyDailyDeadfallTrapResolution(nextState);
  applyDailyFishTrapResolution(nextState);
  applyDailyAutoRodResolution(nextState);
}
