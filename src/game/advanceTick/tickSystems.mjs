import { resetActorTickBudgetsForNewDay } from './budget.mjs';

export function advanceOneTickImpl(state, hooks) {
  const {
    progressPartnerTaskQueueOneTick,
    processAutoRodTickResolution,
    applyColdExposureTick,
    TICKS_PER_DAY,
    advanceDay,
    ensureTickSystems,
    getActorDayStartTickBudgetBase,
  } = hooks;

  progressPartnerTaskQueueOneTick(state);
  processAutoRodTickResolution(state);
  applyColdExposureTick(state);
  state.dayTick += 1;
  if (state.dayTick < TICKS_PER_DAY) {
    return state;
  }

  const rolled = advanceDay(state, 1);
  ensureTickSystems(rolled);
  rolled.dayTick = 0;
  rolled.currentDayActionLog = [];
  resetActorTickBudgetsForNewDay(rolled, getActorDayStartTickBudgetBase);
  return rolled;
}
