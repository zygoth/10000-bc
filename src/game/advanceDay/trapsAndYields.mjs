export function runDailyTrapAndYieldStep(nextState, hooks) {
  const {
    applyBeehiveSeasonalState,
    applyFishPopulationRecovery,
    applyDailyItemDecay,
    applyDailySapTapFill,
    applyDailySimpleSnareResolution,
    applyDailyDeadfallTrapResolution,
    applyDailyFishTrapResolution,
    applyDailyAutoRodResolution,
  } = hooks;

  applyBeehiveSeasonalState(nextState);
  applyFishPopulationRecovery(nextState);
  applyDailyItemDecay(nextState);
  applyDailySapTapFill(nextState);
  applyDailySimpleSnareResolution(nextState);
  applyDailyDeadfallTrapResolution(nextState);
  applyDailyFishTrapResolution(nextState);
  applyDailyAutoRodResolution(nextState);
}
