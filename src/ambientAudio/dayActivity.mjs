import { TICKS_PER_DAY } from '../game/simCore.constants.mjs';

/**
 * @param {object} entry ambient catalog entry
 * @param {number} dayTick 0..TICKS_PER_DAY-1
 * @returns {number} 0..1 relative activity
 */
export function resolveDayActivityFactor(entry, dayTick) {
  const da = entry?.day_activity;
  if (!da || da.kind !== 'day_tick_segments' || !Array.isArray(da.segments)) {
    return 1;
  }
  const tick = Math.max(0, Math.min(TICKS_PER_DAY - 1, Math.floor(Number(dayTick) || 0)));
  for (const seg of da.segments) {
    const from = Number(seg.from_tick);
    const to = Number(seg.to_tick);
    const rel = Number(seg.relative);
    if (Number.isInteger(from) && Number.isInteger(to) && tick >= from && tick < to && Number.isFinite(rel)) {
      return Math.max(0, rel);
    }
  }
  return 1;
}
