import { Graphics } from 'pixi.js';
import { isWindCalm } from './windStrengthField.mjs';
import { windUnitVector } from './windDustSpawn.mjs';
import { wrapScreenPosition } from './windDustViewport.mjs';

const POOL_SIZE = 64;
const DUST_COLOR = 0xd4b88a;
const BASE_DRIFT_PX_PER_SEC = 48;
const PARTICLE_RADIUS = 2.6;
const PARTICLE_ALPHA = 0.58;

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function assignVelocity(slot, windDir, rng) {
  const perpX = -windDir.y;
  const perpY = windDir.x;
  const jitter = 0.14;
  slot.vx = windDir.x + perpX * (rng() - 0.5) * jitter;
  slot.vy = windDir.y + perpY * (rng() - 0.5) * jitter;
  const len = Math.hypot(slot.vx, slot.vy) || 1;
  slot.vx /= len;
  slot.vy /= len;
}

/**
 * Viewport-pinned dust that counter-scrolls each frame to stay world-locked.
 * Off-screen particles wrap to the opposite edge to keep density uniform while moving.
 */
export class WindDustLayer {
  constructor(root) {
    this.container = root;
    this.graphics = new Graphics({ roundPixels: true });
    this.container.addChild(this.graphics);
    this.container.eventMode = 'none';
    /** @type {Array<{ active: boolean, sx: number, sy: number, vx: number, vy: number }>} */
    this.particles = Array.from({ length: POOL_SIZE }, () => ({
      active: false,
      sx: 0,
      sy: 0,
      vx: 0,
      vy: 0,
    }));
    this._spawnRng = mulberry32(0xD057);
    this._seededForWind = false;
  }

  destroy() {
    this.graphics.destroy();
  }

  /**
   * @param {number} dtMs
   * @param {import('./windStrengthField.mjs').WindStrengthField} windField
   * @param {{ x?: number, y?: number, strength?: number, angleRadians?: number } | null} windVector
   * @param {number} viewW
   * @param {number} viewH
   * @param {{ dx: number, dy: number }} scrollDelta screen motion of world content since last frame
   */
  step(dtMs, windField, windVector, viewW, viewH, scrollDelta) {
    const w = Math.max(1, Math.floor(Number(viewW) || 0));
    const h = Math.max(1, Math.floor(Number(viewH) || 0));

    const strength = Number(windVector?.strength) || 0;
    if (isWindCalm(strength)) {
      this.graphics.clear();
      for (const p of this.particles) {
        p.active = false;
      }
      this._seededForWind = false;
      return;
    }

    const dt = Math.max(0, Math.min(0.1, Number(dtMs) / 1000));
    const windDir = windUnitVector(windVector);
    const rng = this._spawnRng;
    const scrollDx = Number(scrollDelta?.dx) || 0;
    const scrollDy = Number(scrollDelta?.dy) || 0;

    if (!this._seededForWind) {
      this._seedAllParticles(windDir, w, h, rng);
      this._seededForWind = true;
    }

    for (const p of this.particles) {
      if (!p.active) {
        continue;
      }
      p.sx += scrollDx;
      p.sy += scrollDy;
      const local = windField.sampleAtScreenPx(p.sx, p.sy);
      const gust = Math.max(0.2, Number(local.multiplier) || 1);
      const speed = BASE_DRIFT_PX_PER_SEC * Math.max(0.12, local.strength) * gust;
      p.sx += p.vx * speed * dt;
      p.sy += p.vy * speed * dt;
      const wrapped = wrapScreenPosition(p.sx, p.sy, w, h, 0);
      p.sx = wrapped.sx;
      p.sy = wrapped.sy;
    }

    this._redraw();
  }

  _placeAt(slot, sx, sy, windDir, rng) {
    slot.active = true;
    slot.sx = sx;
    slot.sy = sy;
    assignVelocity(slot, windDir, rng);
  }

  _seedAllParticles(windDir, viewW, viewH, rng) {
    for (const slot of this.particles) {
      this._placeAt(slot, rng() * viewW, rng() * viewH, windDir, rng);
    }
  }

  _redraw() {
    const g = this.graphics;
    g.clear();
    for (const p of this.particles) {
      if (!p.active) {
        continue;
      }
      g.circle(p.sx, p.sy, PARTICLE_RADIUS);
      g.fill({ color: DUST_COLOR, alpha: PARTICLE_ALPHA });
    }
  }
}

export { POOL_SIZE, BASE_DRIFT_PX_PER_SEC, isWindCalm };
