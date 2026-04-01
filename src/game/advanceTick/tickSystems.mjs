import { resetActorTickBudgetsForNewDay } from './budget.mjs';

export function advanceOneTickImpl(state, hooks) {
  const {
    progressPartnerTaskQueueOneTick,
    processAutoRodTickResolution,
    applyColdExposureTick,
    applyTemperatureThirstTick,
    applyGlobalHungerTick,
    applyItemDecayAndDryingTick,
    TICKS_PER_DAY,
    advanceDay,
    ensureTickSystems,
    getActorDayStartTickBudgetBase,
  } = hooks;

  progressPartnerTaskQueueOneTick(state);
  processAutoRodTickResolution(state);
  applyColdExposureTick(state);
  applyTemperatureThirstTick(state);
  applyGlobalHungerTick(state);
  if (typeof applyItemDecayAndDryingTick === 'function') {
    applyItemDecayAndDryingTick(state);
  }
  state.dayTick += 1;
  if (state.dayTick < TICKS_PER_DAY) {
    return state;
  }

  const rolled = advanceDay(state, 1, { skipBatchItemProgress: true });
  ensureTickSystems(rolled);
  rolled.dayTick = 0;
  rolled.currentDayActionLog = [];
  if (rolled?.camp?.debrief && typeof rolled.camp.debrief === 'object') {
    rolled.camp.debrief.active = false;
    rolled.camp.debrief.openedAtDay = null;
    rolled.camp.debrief.medicineRequests = [];
    rolled.camp.debrief.medicineNotifications = [];
    rolled.camp.debrief.visionRequest = null;
    rolled.camp.debrief.visionSelectionOptions = [];
    rolled.camp.debrief.requiresVisionConfirmation = false;
    rolled.camp.debrief.visionNotifications = [];
    rolled.camp.debrief.pendingVisionRevelation = null;
    rolled.camp.debrief.pendingVisionChoices = [];
    rolled.camp.debrief.chosenVisionRewards = [];
  }
  resetActorTickBudgetsForNewDay(rolled, getActorDayStartTickBudgetBase);
  for (const actor of Object.values(rolled.actors || {})) {
    if ((Number(actor?.health) || 0) <= 0) {
      continue;
    }
    const activeSight = Number.isInteger(actor?.natureSightDaysRemaining)
      ? actor.natureSightDaysRemaining
      : Math.floor(Number(actor?.natureSightDaysRemaining || 0));
    const pendingSight = Number.isInteger(actor?.natureSightPendingDays)
      ? actor.natureSightPendingDays
      : Math.floor(Number(actor?.natureSightPendingDays || 0));
    if (activeSight > 0) {
      actor.natureSightDaysRemaining = Math.max(0, activeSight - 1);
    } else {
      actor.natureSightDaysRemaining = 0;
    }
    if (pendingSight > 0) {
      actor.natureSightDaysRemaining += pendingSight;
    }
    actor.natureSightPendingDays = 0;
    if (actor.natureSightDaysRemaining <= 0) {
      actor.natureSightOverlayChoice = null;
      actor.natureSightOverlayChosenDay = null;
    }

    const visionPenalty = Number.isInteger(actor?.visionNextDayTickPenalty)
      ? actor.visionNextDayTickPenalty
      : Math.floor(Number(actor?.visionNextDayTickPenalty || 0));
    if (visionPenalty > 0) {
      actor.tickBudgetCurrent = Math.max(0, (Number(actor.tickBudgetCurrent) || 0) - visionPenalty);
    }
    actor.visionNextDayTickPenalty = 0;
  }
  const stewBonus = Number.isFinite(Number(rolled?.camp?.nextDayStewTickBonus))
    ? Math.max(0, Math.floor(Number(rolled.camp.nextDayStewTickBonus)))
    : 0;
  if (stewBonus > 0) {
    for (const actor of Object.values(rolled.actors || {})) {
      if ((Number(actor?.health) || 0) <= 0) {
        continue;
      }
      actor.tickBudgetCurrent = (Number(actor.tickBudgetCurrent) || 0) + stewBonus;
    }
    if (rolled?.camp) {
      rolled.camp.nextDayStewTickBonus = 0;
    }
  }
  return rolled;
}
