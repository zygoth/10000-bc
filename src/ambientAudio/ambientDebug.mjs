import { chebyshev } from './ambientMath.mjs';
import { isCampfireEligible, listenerInCampFootprint } from './ambientEligibility.mjs';

/**
 * In DevTools: localStorage.setItem('debug-ambient', '1')  →  reload
 * localStorage.removeItem('debug-ambient')  →  off
 */
export function isAmbientDebugEnabled() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    return window.localStorage.getItem('debug-ambient') === '1';
  } catch {
    return false;
  }
}

const throttleByKey = new Map();

/**
 * @param {string} key
 * @param {number} ms
 * @param {() => void} fn
 */
export function runAmbientDebugThrottled(key, ms, fn) {
  if (!isAmbientDebugEnabled()) {
    return;
  }
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const last = throttleByKey.get(key) || 0;
  if (now - last < ms) {
    return;
  }
  throttleByKey.set(key, now);
  fn();
}

/**
 * @param {object} state
 * @param {number} lx
 * @param {number} ly
 * @param {object} entry catalog entry (camp_campfire)
 */
export function snapshotCampfireEligibility(state, lx, ly, entry) {
  const p = state?.actors?.player;
  const pfx = Math.floor(Number(p?.x));
  const pfy = Math.floor(Number(p?.y));
  const playerInt = Number.isInteger(pfx) && Number.isInteger(pfy);
  if (!state?.camp || !entry) {
    return { error: 'no camp or entry' };
  }
  const ax = Math.floor(Number(state.camp.anchorX));
  const ay = Math.floor(Number(state.camp.anchorY));
  const maxRaw = entry?.audibility?.max_chebyshev_tiles_from_camp_anchor;
  const maxD = (Number.isFinite(Number(maxRaw)) && Number(maxRaw) >= 0)
    ? Math.floor(Number(maxRaw))
    : 3;
  const cheb = (Number.isInteger(lx) && Number.isInteger(ly) && Number.isInteger(ax) && Number.isInteger(ay))
    ? chebyshev(lx, ly, ax, ay)
    : -1;
  return {
    anchor: { x: ax, y: ay },
    listenerTile: { x: lx, y: ly },
    chebyshevToAnchor: cheb,
    maxChebyshev: maxD,
    inAnchorRange: cheb >= 0 && cheb <= maxD,
    requiresFootprint: entry?.audibility?.requires_listener_in_camp_footprint === true,
    inCampFootprint: listenerInCampFootprint(state, lx, ly),
    eligible: isCampfireEligible(entry, state, lx, ly),
    playerTile: playerInt ? { x: pfx, y: pfy } : null,
    earMatchesPlayerTile: playerInt && pfx === lx && pfy === ly,
  };
}
