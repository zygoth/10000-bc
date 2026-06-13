/** Multiplier applied to debris spawn rates while debugging. */
export const WIND_DEBRIS_DEBUG_SPAWN_RATE_MULT = 40;

/**
 * On by default in non-production builds. Override in DevTools:
 * `localStorage.setItem('debug-wind-debris', '0')` — force off
 * `localStorage.setItem('debug-wind-debris', '1')` — force on (production too)
 * `localStorage.removeItem('debug-wind-debris')` — restore default
 */
export function windDebrisDebugSpawnMultiplier() {
  if (typeof window === 'undefined') {
    return 1;
  }
  try {
    const flag = window.localStorage?.getItem('debug-wind-debris');
    if (flag === '0') {
      return 1;
    }
    if (flag === '1' || process.env.NODE_ENV !== 'production') {
      return WIND_DEBRIS_DEBUG_SPAWN_RATE_MULT;
    }
  } catch {
    // ignore
  }
  return 1;
}
