export function applyYearRollover(nextState, hooks) {
  const { advanceDeadLogDecayByYear, refillSquirrelCachesByYear } = hooks;
  advanceDeadLogDecayByYear(nextState);
  refillSquirrelCachesByYear(nextState);
}
