import { getCampMaintenanceReserveTicks } from './campMaintenance.mjs';
import { getActorDayStartTickBudgetBase } from './simCore.mjs';

export { getCampMaintenanceReserveTicks } from './campMaintenance.mjs';

/**
 * Partner tick budget available for the manual queue after tomorrow's reset (nominal).
 * Uses camp.nextDayStewTickBonus when set (after stew commit); otherwise optional mealPlanPreview from debrief.
 */
export function getPartnerTomorrowQueueCapacityPreview(state, partner, mealPlanPreview = null) {
  if (!partner || typeof partner !== 'object') {
    return {
      dayStartBase: 0,
      stewBonus: 0,
      maintenanceReserve: 0,
      queueCapacity: 0,
    };
  }
  const dayStartBase = getActorDayStartTickBudgetBase(state, partner);
  let stewBonus = Math.max(0, Math.floor(Number(state?.camp?.nextDayStewTickBonus) || 0));
  if (stewBonus <= 0 && mealPlanPreview && mealPlanPreview.bonusEligible === true) {
    stewBonus = Math.max(0, Math.floor(Number(mealPlanPreview.nextDayTickBonus) || 0));
  }
  const maintenanceReserve = getCampMaintenanceReserveTicks(state);
  const queueCapacity = Math.max(0, dayStartBase + stewBonus);
  return {
    dayStartBase,
    stewBonus,
    maintenanceReserve,
    queueCapacity,
  };
}
