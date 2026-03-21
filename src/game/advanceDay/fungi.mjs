export function runDailyFungiStep(nextState, rng, hooks) {
  const { applyLogFungusFruiting, applyGroundFungusFruiting } = hooks;
  applyLogFungusFruiting(nextState, rng);
  applyGroundFungusFruiting(nextState, rng);
}
