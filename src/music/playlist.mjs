/**
 * For matching a browser audio URL (often percent-encoded path) to manifest entries (unencoded file names).
 * @param {string} path pathname or file URL, with or without %20 etc.
 * @returns {string}
 */
export function normalizePathForMatch(path) {
  if (path == null || typeof path !== 'string') {
    return '';
  }
  let s = path.trim();
  if (s.length === 0) {
    return '';
  }
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('file:')) {
    try {
      s = new URL(s, 'http://local.invalid').pathname;
    } catch {
      /* use s */
    }
  }
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

/**
 * @param {T[]} arr
 * @param {() => number} [rng01] 0..1
 * @returns {T[]}
 */
export function fisherYatesShuffle(arr, rng01 = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng01() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/**
 * @param {string[]} urls
 * @param {string|null} [avoidFirstIfPossible] prefer not to start with this id when |urls|>1
 * @param {() => number} [rng01]
 * @returns {string[]}
 */
export function buildSeasonOrder(urls, avoidFirstIfPossible = null, rng01 = Math.random) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }
  if (urls.length === 1) {
    return [urls[0]];
  }
  let order = fisherYatesShuffle(urls, rng01);
  if (
    avoidFirstIfPossible
    && order[0] === avoidFirstIfPossible
  ) {
    const swap = order.findIndex((u) => u !== avoidFirstIfPossible);
    if (swap > 0) {
      const tmp = order[0];
      order[0] = order[swap];
      order[swap] = tmp;
    }
  }
  return order;
}

/**
 * @param {string[]} urls
 * @param {{ order: string[], i: number }} [state]
 * @param {() => number} [rng01]
 * @returns {{ nextUrl: string|null, state: { order: string[], i: number } }}
 */
export function nextFromOrder(urls, state, rng01 = Math.random) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return { nextUrl: null, state: { order: [], i: 0 } };
  }
  if (!state || !Array.isArray(state.order) || state.order.length === 0) {
    const order = buildSeasonOrder(urls, null, rng01);
    return { nextUrl: order[0] || null, state: { order, i: 0 } };
  }
  const nextI = state.i + 1;
  if (nextI >= state.order.length) {
    const last = state.order[state.order.length - 1];
    const order = buildSeasonOrder(urls, last, rng01);
    return { nextUrl: order[0] || null, state: { order, i: 0 } };
  }
  return { nextUrl: state.order[nextI] || null, state: { order: state.order, i: nextI } };
}

/**
 * @param {number} tSec
 * @param {number} durationSec
 * @param {number} [epsilon=0.05]
 */
export function clampResumeTimeSec(tSec, durationSec, epsilon = 0.05) {
  if (!Number.isFinite(tSec) || tSec < 0) {
    return 0;
  }
  if (!Number.isFinite(durationSec) || durationSec <= epsilon) {
    return 0;
  }
  return Math.min(tSec, durationSec - epsilon);
}

/**
 * t in [0,1] over the fade window (linear crossfade).
 * @param {number} t01
 * @param {number} a0
 * @param {number} a1
 * @param {number} b0
 * @param {number} b1
 * @returns {{ a: number, b: number }}
 */
export function crossfadeVolumes(t01, a0, a1, b0, b1) {
  const t = Math.max(0, Math.min(1, t01));
  return {
    a: a0 + (a1 - a0) * t,
    b: b0 + (b1 - b0) * t,
  };
}
