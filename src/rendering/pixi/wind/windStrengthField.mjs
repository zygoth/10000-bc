import { PERLIN_DEFAULT_PERIOD, perlin2d, wrapNoiseCoord } from './perlinNoise2d.mjs';

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export const WIND_FIELD_DEFAULTS = {
  spatialScale: 220,
  jitterAmp: 0.58,
  scrollSpeed: 28,
  wrapPeriod: PERLIN_DEFAULT_PERIOD,
  noiseSeed: 42,
};

/**
 * Scrolling tileable wind-strength field for renderer-only gust variation.
 */
export class WindStrengthField {
  constructor(options = null) {
    const o = options || {};
    this.spatialScale = Number(o.spatialScale) || WIND_FIELD_DEFAULTS.spatialScale;
    this.jitterAmp = Number(o.jitterAmp) || WIND_FIELD_DEFAULTS.jitterAmp;
    this.scrollSpeed = Number(o.scrollSpeed) || WIND_FIELD_DEFAULTS.scrollSpeed;
    this.wrapPeriod = Number(o.wrapPeriod) || WIND_FIELD_DEFAULTS.wrapPeriod;
    this.noiseSeed = Number(o.noiseSeed) || WIND_FIELD_DEFAULTS.noiseSeed;
    this.scrollX = 0;
    this.scrollY = 0;
    this.baseStrength = 0;
  }

  reset() {
    this.scrollX = 0;
    this.scrollY = 0;
    this.baseStrength = 0;
  }

  /**
   * @param {number} dtMs
   * @param {{ x?: number, y?: number, strength?: number, angleRadians?: number } | null} windVector
   */
  tick(dtMs, windVector) {
    const dt = Math.max(0, Math.min(0.1, Number(dtMs) / 1000));
    const strength = clamp01(windVector?.strength);
    this.baseStrength = strength;
    if (strength <= 0) {
      return;
    }
    const angle = Number.isFinite(Number(windVector?.angleRadians))
      ? Number(windVector.angleRadians)
      : Math.atan2(Number(windVector?.y) || 0, Number(windVector?.x) || 0);
    const speed = this.scrollSpeed * strength;
    this.scrollX += Math.cos(angle) * speed * dt;
    this.scrollY += Math.sin(angle) * speed * dt;
    this.scrollX = wrapNoiseCoord(this.scrollX, this.wrapPeriod);
    this.scrollY = wrapNoiseCoord(this.scrollY, this.wrapPeriod);
  }

  /**
   * @param {number} screenX
   * @param {number} screenY
   * @returns {{ strength: number, multiplier: number, noise: number }}
   */
  sampleAtScreenPx(screenX, screenY) {
    const base = this.baseStrength;
    if (base <= 0) {
      return { strength: 0, multiplier: 0, noise: 0 };
    }
    const u = wrapNoiseCoord((Number(screenX) || 0) / this.spatialScale + this.scrollX, this.wrapPeriod);
    const v = wrapNoiseCoord((Number(screenY) || 0) / this.spatialScale + this.scrollY, this.wrapPeriod);
    const noise = perlin2d(u, v, { seed: this.noiseSeed, period: this.wrapPeriod });
    const multiplier = lerp(1 - this.jitterAmp, 1 + this.jitterAmp, noise);
    const localStrength = clamp01(base * multiplier);
    return { strength: localStrength, multiplier, noise };
  }
}

/**
 * @param {number} strength
 * @returns {boolean}
 */
export function isWindCalm(strength) {
  return clamp01(strength) < 0.2;
}
