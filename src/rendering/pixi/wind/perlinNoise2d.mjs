/** Tileable 2D Perlin noise in [0, 1]. Period must be a power of two. */

const DEFAULT_PERIOD = 256;

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function buildPermutation(seed, period) {
  const perm = new Uint8Array(period * 2);
  const source = new Uint8Array(period);
  for (let i = 0; i < period; i += 1) {
    source[i] = i;
  }
  let state = (seed >>> 0) || 1;
  for (let i = period - 1; i > 0; i -= 1) {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state = Math.imul(state ^ (state >>> 13), 1 | state);
    const r = ((state ^ (state >>> 16)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    const tmp = source[i];
    source[i] = source[j];
    source[j] = tmp;
  }
  for (let i = 0; i < period; i += 1) {
    perm[i] = source[i];
    perm[i + period] = source[i];
  }
  return perm;
}

function grad(hash, x, y) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

const permCache = new Map();

function getPerm(seed, period) {
  const key = `${seed}\0${period}`;
  let perm = permCache.get(key);
  if (!perm) {
    perm = buildPermutation(seed, period);
    permCache.set(key, perm);
  }
  return perm;
}

function wrapCoord(value, period) {
  const v = value % period;
  return v < 0 ? v + period : v;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {{ seed?: number, period?: number }} [options]
 * @returns {number} 0..1
 */
export function perlin2d(x, y, options = null) {
  const period = options?.period ?? DEFAULT_PERIOD;
  const seed = options?.seed ?? 42;
  const perm = getPerm(seed, period);

  const x0 = Math.floor(x) & (period - 1);
  const y0 = Math.floor(y) & (period - 1);
  const x1 = (x0 + 1) & (period - 1);
  const y1 = (y0 + 1) & (period - 1);

  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);

  const aa = perm[perm[x0] + y0];
  const ab = perm[perm[x0] + y1];
  const ba = perm[perm[x1] + y0];
  const bb = perm[perm[x1] + y1];

  const x1f = xf - 1;
  const y1f = yf - 1;
  const n00 = grad(aa, xf, yf);
  const n10 = grad(ba, x1f, yf);
  const n01 = grad(ab, xf, y1f);
  const n11 = grad(bb, x1f, y1f);

  const nx0 = lerp(n00, n10, u);
  const nx1 = lerp(n01, n11, u);
  const value = lerp(nx0, nx1, v);
  return (value + 1) * 0.5;
}

/** @param {number} value */
export function wrapNoiseCoord(value, period = DEFAULT_PERIOD) {
  return wrapCoord(value, period);
}

export const PERLIN_DEFAULT_PERIOD = DEFAULT_PERIOD;
