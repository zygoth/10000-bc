import { perlin2d, PERLIN_DEFAULT_PERIOD, wrapNoiseCoord } from './perlinNoise2d.mjs';

describe('perlinNoise2d', () => {
  it('returns values in [0, 1]', () => {
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const v = perlin2d(x * 0.7, y * 0.9, { seed: 7 });
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic for the same seed and coordinates', () => {
    const a = perlin2d(12.5, 48.2, { seed: 99 });
    const b = perlin2d(12.5, 48.2, { seed: 99 });
    expect(a).toBe(b);
  });

  it('wrapNoiseCoord tiles at the period boundary', () => {
    expect(wrapNoiseCoord(0, PERLIN_DEFAULT_PERIOD)).toBe(0);
    expect(wrapNoiseCoord(PERLIN_DEFAULT_PERIOD, PERLIN_DEFAULT_PERIOD)).toBe(0);
    expect(wrapNoiseCoord(-1, PERLIN_DEFAULT_PERIOD)).toBe(PERLIN_DEFAULT_PERIOD - 1);
  });

  it('samples are continuous across integer lattice steps', () => {
    const left = perlin2d(10, 20, { seed: 1 });
    const right = perlin2d(11, 20, { seed: 1 });
    expect(Math.abs(left - right)).toBeLessThan(0.5);
  });
});
