import { getSeason } from './plantCatalog.mjs';
import { WINDBREAK_REFLECTOR_WALL_STATION_ID } from './simCore.constants.mjs';

/** Partner queue task kind for daily auto camp upkeep (fire, stew prep, water). */
export const CAMP_MAINTENANCE_TASK_KIND = 'camp_maintenance';

/** Partner queue row after pass-out outside camp — carries the player home; fixed, non-removable (GDD §2.2). */
export const PARTNER_PLAYER_RESCUE_TASK_KIND = 'partner_player_rescue';

/** Tick cost for the rescue row (matches partner next-day penalty in GDD §2.2). */
export const PARTNER_PLAYER_RESCUE_TICKS = 30;

/**
 * Calendar day index used for partner queue maintenance rows.
 * During nightly debrief we plan the *next* sim day while totalDaysSimulated is still "today".
 */
export function getPartnerQueuePlanningDay(state) {
  const d = Number(state?.totalDaysSimulated) || 0;
  if (state?.camp?.debrief?.active === true) {
    return d + 1;
  }
  return d;
}

/**
 * GDD §7.4 — illustrative reserve for auto camp maintenance (fire, stew prep, water).
 * Used for the mandatory partner queue row and debrief planning copy.
 */
export function getCampMaintenanceReserveTicks(state) {
  const dayOfYear = Number(state?.dayOfYear) || 1;
  const season = getSeason(dayOfYear);
  const freezing = String(state?.dailyTemperatureBand || '').toLowerCase() === 'freezing';
  const stations = state?.camp?.stationsUnlocked;
  const hasWindbreak = Array.isArray(stations) && stations.includes(WINDBREAK_REFLECTOR_WALL_STATION_ID);

  if (freezing || season === 'winter') {
    return hasWindbreak ? 25 : 35;
  }
  return 20;
}
