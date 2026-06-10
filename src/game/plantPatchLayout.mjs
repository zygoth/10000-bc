function clampInt(value, min, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.floor(n));
}

function stringHashSeed(input) {
  const str = String(input || 'seed');
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function speciesMaxLifeStageSize(species) {
  if (!species || !Array.isArray(species.lifeStages)) {
    return 1;
  }
  let maxSize = 1;
  for (const stage of species.lifeStages) {
    const size = Number(stage?.size);
    if (Number.isFinite(size)) {
      maxSize = Math.max(maxSize, Math.max(1, Math.round(size)));
    }
  }
  return maxSize;
}

export function stageSizeForPlant(species, plant) {
  const stageName = typeof plant?.stageName === 'string' ? plant.stageName : '';
  const stage = (species?.lifeStages || []).find((entry) => entry?.stage === stageName) || null;
  const size = Number(stage?.size);
  if (!Number.isFinite(size)) {
    return 1;
  }
  return Math.max(1, Math.round(size));
}

/** Min scale at life-stage `size` 1 for iso plant sprites; size 10 maps to 1.0 (full tile-relative scale). */
export const LIFE_STAGE_VISUAL_SCALE_MIN = 0.40;

/**
 * Visual scale factor for a life-stage `size` (1–10) on the iso map. Linear from
 * {@link LIFE_STAGE_VISUAL_SCALE_MIN} at 1 to 1.0 at 10.
 *
 * @param {number} stageSize
 * @returns {number}
 */
export function lifeStageSizeVisualScaleMultiplier(stageSize) {
  const raw = Number(stageSize);
  const rounded = Number.isFinite(raw) ? Math.round(raw) : 1;
  const clamped = Math.max(1, Math.min(10, rounded));
  return LIFE_STAGE_VISUAL_SCALE_MIN
    + ((clamped - 1) / 9) * (1 - LIFE_STAGE_VISUAL_SCALE_MIN);
}

export function defaultPatchCapacityForMaxSize(speciesMaxSize) {
  const maxSize = Math.max(1, Math.round(Number(speciesMaxSize) || 1));
  if (maxSize >= 5) {
    return 1;
  }
  if (maxSize >= 4) {
    return 2;
  }
  if (maxSize >= 2) {
    return 4;
  }
  return 9;
}

export function resolvePatchCapacity(species, plant) {
  if (!species || typeof species !== 'object') {
    return 1;
  }
  const override = clampInt(species?.maxPlantsPerTile, 1, null);
  if (override !== null) {
    return override;
  }
  const maxSize = speciesMaxLifeStageSize(species);
  return defaultPatchCapacityForMaxSize(maxSize);
}

export function patchSpriteScaleForCapacity(capacity, stageSize, baseScale = 1) {
  const c = Math.max(1, Math.floor(Number(capacity) || 1));
  const st = Math.max(1, Math.floor(Number(stageSize) || 1));
  if (st >= 5 || c <= 1) {
    return baseScale;
  }
  if (c >= 9) {
    return baseScale * 0.38;
  }
  if (c >= 4) {
    return baseScale * 0.5;
  }
  if (c >= 2) {
    return baseScale * 0.72;
  }
  return baseScale;
}

const GROUND_FUNGUS_GRAMS_PER_CLUSTER_VISUAL = 16;
const GROUND_FUNGUS_MAX_ZONE_SPRITE_COPIES = 9;

/**
 * How many small zone-tile sprite copies to draw for a `yieldCurrentGrams` value (roughly scale with harvestable mass).
 * @param {number} grams
 * @returns {number}
 */
export function groundFungusClusterCountForYieldGrams(grams) {
  const g = Math.max(0, Math.floor(Number(grams) || 0));
  if (g <= 0) {
    return 0;
  }
  return Math.min(
    GROUND_FUNGUS_MAX_ZONE_SPRITE_COPIES,
    Math.max(1, Math.round(g / GROUND_FUNGUS_GRAMS_PER_CLUSTER_VISUAL)),
  );
}

/**
 * Stable per-mushroom scale factor for iso ground-fungus sprites (no yield-based shrink).
 * @param {string} seedKey
 * @returns {number} multiplier ~0.82–1.10
 */
export function deterministicMushroomScaleJitter(seedKey) {
  return 0.82 + mulberry32(stringHashSeed(seedKey))() * 0.28;
}

function ringSlotsForCapacity(capacity) {
  const count = Math.max(1, Math.floor(Number(capacity) || 1));
  if (count === 1) {
    return [{ gx: 0, gy: 0 }];
  }
  if (count === 2) {
    return [
      { gx: -0.5, gy: 0 },
      { gx: 0.5, gy: 0 },
    ];
  }
  if (count === 3) {
    return [
      { gx: 0, gy: -0.5 },
      { gx: -0.6, gy: 0.45 },
      { gx: 0.6, gy: 0.45 },
    ];
  }
  if (count === 4) {
    return [
      { gx: -0.5, gy: -0.5 },
      { gx: 0.5, gy: -0.5 },
      { gx: -0.5, gy: 0.5 },
      { gx: 0.5, gy: 0.5 },
    ];
  }
  if (count === 9) {
    return [
      { gx: -1, gy: -1 },
      { gx: 0, gy: -1 },
      { gx: 1, gy: -1 },
      { gx: -1, gy: 0 },
      { gx: 0, gy: 0 },
      { gx: 1, gy: 0 },
      { gx: -1, gy: 1 },
      { gx: 0, gy: 1 },
      { gx: 1, gy: 1 },
    ];
  }

  const side = Math.max(2, Math.ceil(Math.sqrt(count)));
  const slots = [];
  const half = (side - 1) / 2;
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      slots.push({ gx: x - half, gy: y - half });
    }
  }
  slots.sort((a, b) => {
    const da = (a.gx * a.gx) + (a.gy * a.gy);
    const db = (b.gx * b.gx) + (b.gy * b.gy);
    if (da !== db) {
      return da - db;
    }
    if (a.gy !== b.gy) {
      return a.gy - b.gy;
    }
    return a.gx - b.gx;
  });
  return slots.slice(0, count);
}

function randomPointInDisk(rng, radius) {
  const t = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * radius;
  return { x: r * Math.cos(t), y: r * Math.sin(t) };
}

/** Uniform random point in annulus [rInner, rOuter] (area-weighted). */
function randomPointInAnnulus(rng, rInner, rOuter) {
  const o = Math.max(0, Number(rOuter) || 0);
  const i0 = Math.max(0, Number(rInner) || 0);
  if (o <= 1e-6) {
    return { x: 0, y: 0 };
  }
  if (o <= i0 + 1e-6) {
    return randomPointInDisk(rng, o);
  }
  const t = rng() * Math.PI * 2;
  const u = rng();
  const isq = i0 * i0;
  const osq = o * o;
  const r = Math.sqrt(isq + u * (osq - isq));
  return { x: r * Math.cos(t), y: r * Math.sin(t) };
}

/**
 * @param {Array<{ x: number, y: number }>} placed
 * @param {number} rMin
 * @param {() => number} rng
 */
function ensureMinRadiusFromOrigin(placed, rMin, rng) {
  const m = Math.max(0, Number(rMin) || 0);
  if (m <= 0) {
    return;
  }
  for (let i = 0; i < placed.length; i += 1) {
    const d = Math.hypot(placed[i].x, placed[i].y);
    if (d < 1e-4) {
      const ang = rng() * Math.PI * 2;
      placed[i].x = Math.cos(ang) * m;
      placed[i].y = Math.sin(ang) * m;
    } else if (d < m) {
      const s = m / d;
      placed[i].x *= s;
      placed[i].y *= s;
    }
  }
}

function passesMinSpacing(placed, x, y, minSpacing) {
  const minD = minSpacing * 0.995;
  for (let i = 0; i < placed.length; i += 1) {
    const p = placed[i];
    if (Math.hypot(x - p.x, y - p.y) < minD) {
      return false;
    }
  }
  return true;
}

function recenterPatch(placed) {
  if (placed.length === 0) {
    return;
  }
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < placed.length; i += 1) {
    sx += placed[i].x;
    sy += placed[i].y;
  }
  const cx = sx / placed.length;
  const cy = sy / placed.length;
  for (let i = 0; i < placed.length; i += 1) {
    placed[i].x -= cx;
    placed[i].y -= cy;
  }
}

function relaxPatchLayout(placed, minSpacing, halfSpan, rng, iterations) {
  const n = placed.length;
  const lim = Math.max(0, halfSpan);
  for (let iter = 0; iter < iterations; iter += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        let dx = placed[j].x - placed[i].x;
        let dy = placed[j].y - placed[i].y;
        let dist = Math.hypot(dx, dy);
        if (dist < 1e-6) {
          const ang = rng() * Math.PI * 2;
          dx = Math.cos(ang);
          dy = Math.sin(ang);
          dist = 1;
        }
        if (dist < minSpacing) {
          const push = (minSpacing - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          placed[i].x -= ux * push;
          placed[i].y -= uy * push;
          placed[j].x += ux * push;
          placed[j].y += uy * push;
        }
      }
    }
    for (let i = 0; i < n; i += 1) {
      placed[i].x = Math.max(-lim, Math.min(lim, placed[i].x));
      placed[i].y = Math.max(-lim, Math.min(lim, placed[i].y));
    }
  }
}

/**
 * Pixel offsets from the tile anchor for each copy of a multi-plant patch.
 * Seeded from `seedKey` so layout is stable, but positions are dispersed with a
 * margin from the nominal tile radius (inset border) and at least `minSpacingPx`
 * apart where geometry allows.
 *
 * @param {number} capacity
 * @param {string} seedKey
 * @param {object} [options]
 * @param {number} [options.radiusPx] — nominal spread from center (default 8)
 * @param {number} [options.minSpacingPx] — target minimum center-to-center distance
 * @param {number} [options.borderPx] — inset from `radiusPx`; random points stay within radius − border
 * @param {number} [options.maxSampleAttempts] — rejection attempts per sprite
 * @param {number} [options.relaxIterations] — separation passes after placement
 * @param {number} [options.avoidOriginRadiusPx] — keep placements at least this far from (0,0) (e.g. clear a plant at center)
 */
export function resolvePatchLayout(capacity, seedKey, options = {}) {
  const count = Math.max(1, Math.floor(Number(capacity) || 1));
  const avoidR = Math.max(0, Number(options.avoidOriginRadiusPx) || 0);
  const radius = Math.max(2, Number(options.radiusPx) || 8);
  const minSpacing = Math.max(1, Number(options.minSpacingPx) || 4);
  const borderOpt = Number(options.borderPx);
  const border = Number.isFinite(borderOpt)
    ? Math.max(0, borderOpt)
    : Math.max(4, Math.min(radius * 0.22, radius * 0.48));
  const innerR = Math.max(0, radius - border);
  const minHalfForAvoid = avoidR > 0 ? avoidR + minSpacing * 0.55 : 0;
  const halfSpan = Math.max(innerR, minSpacing * 0.52, minHalfForAvoid);
  const maxAttempts = Math.max(25, Math.floor(Number(options.maxSampleAttempts) || 70));
  const relaxIterations = Math.max(0, Math.floor(Number(options.relaxIterations) || 7));
  const rng = mulberry32(stringHashSeed(seedKey));

  if (count === 1) {
    if (avoidR > 0) {
      const t = rng() * Math.PI * 2;
      const rPlace = avoidR + Math.max(1, minSpacing * 0.25);
      return [{ x: Math.cos(t) * rPlace, y: Math.sin(t) * rPlace, depthY: 0 }];
    }
    return [{ x: 0, y: 0, depthY: 0 }];
  }

  const fallbackSlots = ringSlotsForCapacity(count);
  const maxAbs = Math.max(
    1,
    ...fallbackSlots.map((slot) => Math.max(Math.abs(slot.gx), Math.abs(slot.gy))),
  );

  const placed = [];

  for (let i = 0; i < count; i += 1) {
    let x = 0;
    let y = 0;
    let found = false;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const p = (avoidR > 0 && halfSpan > avoidR)
        ? randomPointInAnnulus(rng, avoidR, halfSpan)
        : randomPointInDisk(rng, halfSpan);
      x = p.x;
      y = p.y;
      if (passesMinSpacing(placed, x, y, minSpacing)) {
        found = true;
        break;
      }
    }
    if (!found) {
      const slot = fallbackSlots[i] || { gx: 0, gy: 0 };
      const scale = (halfSpan * 0.82) / maxAbs;
      x = slot.gx * scale;
      y = slot.gy * scale;
      let bump = 0;
      while (!passesMinSpacing(placed, x, y, minSpacing) && bump < 14) {
        x += (rng() * 2 - 1) * minSpacing * 0.45;
        y += (rng() * 2 - 1) * minSpacing * 0.45;
        x = Math.max(-halfSpan, Math.min(halfSpan, x));
        y = Math.max(-halfSpan, Math.min(halfSpan, y));
        bump += 1;
      }
    }
    placed.push({ x, y, depthY: y });
  }

  recenterPatch(placed);
  if (avoidR > 0) {
    ensureMinRadiusFromOrigin(placed, avoidR, rng);
  }
  relaxPatchLayout(placed, minSpacing, halfSpan, rng, relaxIterations);
  recenterPatch(placed);
  if (avoidR > 0) {
    ensureMinRadiusFromOrigin(placed, avoidR, rng);
  }

  for (let i = 0; i < placed.length; i += 1) {
    placed[i].depthY = placed[i].y;
  }
  placed.sort((a, b) => a.depthY - b.depthY);
  return placed;
}
