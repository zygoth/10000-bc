/** Deterministic PRNG (same family as sim tooling). */
export function mulberry32(seed) {
  let t = Math.floor(Number(seed)) || 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp01(x) {
  return Math.max(0, Math.min(1, Number(x) || 0));
}

export function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}
