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

export function resolvePatchLayout(capacity, seedKey, options = {}) {
  const count = Math.max(1, Math.floor(Number(capacity) || 1));
  if (count === 1) {
    return [{ x: 0, y: 0, depthY: 0 }];
  }

  const radius = Math.max(2, Number(options.radiusPx) || 8);
  const minSpacing = Math.max(1, Number(options.minSpacingPx) || 4);
  const jitterPx = Math.max(0, Number(options.jitterPx) || 0);
  const rng = mulberry32(stringHashSeed(seedKey));
  const slots = ringSlotsForCapacity(count);
  const maxAbs = Math.max(1, ...slots.map((slot) => Math.max(Math.abs(slot.gx), Math.abs(slot.gy))));
  const placed = [];

  for (const slot of slots) {
    const baseX = (slot.gx / maxAbs) * radius;
    const baseY = (slot.gy / maxAbs) * radius;
    let x = baseX + ((rng() * 2 - 1) * jitterPx);
    let y = baseY + ((rng() * 2 - 1) * jitterPx);

    for (const prior of placed) {
      const dx = x - prior.x;
      const dy = y - prior.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= minSpacing || dist === 0) {
        continue;
      }
      const push = (minSpacing - dist) / 2;
      const ux = dx / dist;
      const uy = dy / dist;
      x += ux * push;
      y += uy * push;
    }

    placed.push({ x, y, depthY: y });
  }

  return placed.sort((a, b) => a.depthY - b.depthY);
}
