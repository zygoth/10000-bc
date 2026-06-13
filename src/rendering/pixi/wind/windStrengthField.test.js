import {
  WindStrengthField,
  WIND_FIELD_DEFAULTS,
  isWindCalm,
} from './windStrengthField.mjs';
import { PERLIN_DEFAULT_PERIOD } from './perlinNoise2d.mjs';

describe('windStrengthField', () => {
  it('isWindCalm matches weather.mjs calm threshold', () => {
    expect(isWindCalm(0.19)).toBe(true);
    expect(isWindCalm(0.2)).toBe(false);
    expect(isWindCalm(0.65)).toBe(false);
  });

  it('returns zero strength samples when base wind is calm', () => {
    const field = new WindStrengthField();
    field.tick(16, { strength: 0, angleRadians: 0, x: 0, y: 0 });
    const sample = field.sampleAtScreenPx(100, 200);
    expect(sample.strength).toBe(0);
    expect(sample.multiplier).toBe(0);
  });

  it('local strength stays within jitter bounds of base strength', () => {
    const field = new WindStrengthField({ jitterAmp: 0.35 });
    const base = 0.6;
    field.tick(16, { strength: base, angleRadians: 0, x: base, y: 0 });
    const min = base * (1 - WIND_FIELD_DEFAULTS.jitterAmp);
    const max = base * (1 + WIND_FIELD_DEFAULTS.jitterAmp);
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const { strength } = field.sampleAtScreenPx(x * 40, y * 40);
        expect(strength).toBeGreaterThanOrEqual(min - 1e-9);
        expect(strength).toBeLessThanOrEqual(max + 1e-9);
      }
    }
  });

  it('scroll offset advances samples over time in wind direction', () => {
    const field = new WindStrengthField({ scrollSpeed: 48, spatialScale: 60 });
    field.tick(16, { strength: 1, angleRadians: 0, x: 1, y: 0 });
    const before = field.sampleAtScreenPx(120, 80);
    field.tick(500, { strength: 1, angleRadians: 0, x: 1, y: 0 });
    const after = field.sampleAtScreenPx(120, 80);
    expect(after.noise).not.toBe(before.noise);
  });

  it('wraps scroll offsets at the noise period', () => {
    const field = new WindStrengthField({ wrapPeriod: PERLIN_DEFAULT_PERIOD, scrollSpeed: 1000 });
    for (let i = 0; i < 200; i += 1) {
      field.tick(16, { strength: 1, angleRadians: 0, x: 1, y: 0 });
    }
    expect(field.scrollX).toBeGreaterThanOrEqual(0);
    expect(field.scrollX).toBeLessThan(PERLIN_DEFAULT_PERIOD);
  });

  it('spatial samples vary across screen positions', () => {
    const field = new WindStrengthField();
    field.tick(16, { strength: 0.8, angleRadians: 1.2, x: 0.3, y: 0.7 });
    const a = field.sampleAtScreenPx(50, 50).strength;
    const b = field.sampleAtScreenPx(250, 180).strength;
    expect(a).not.toBe(b);
  });
});
