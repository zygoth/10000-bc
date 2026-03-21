export function resetActorTickBudgetsForNewDay(state, getActorDayStartTickBudgetBase) {
  for (const actor of Object.values(state.actors || {})) {
    const base = getActorDayStartTickBudgetBase(state, actor);
    const carryOver = Number(actor.overdraftTicks) || 0;
    actor.tickBudgetCurrent = Math.max(0, base - carryOver);
    actor.overdraftTicks = 0;
  }
}
