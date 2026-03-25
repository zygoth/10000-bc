/**
 * waterGen.js
 *
 * Standalone water generation module for 10,000 BC.
 * Takes a heightmap and returns classified water tiles with pond surface elevations
 * and moving-water current strength.
 *
 * Usage:
 *   import { generateWater } from './waterGen.js';
 *
 *   const result = generateWater(heightmap, width, height, options);
 *
 * Input:
 *   heightmap  — Float32Array of length width*height, values normalised [0,1],
 *                index = y * width + x
 *   width      — integer map width
 *   height     — integer map height
 *   options    — see DEFAULT_OPTIONS below
 *
 * Output: {
 *   moving     — Uint8Array[width*height]  1 = moving water tile (river)
 *   still      — Uint8Array[width*height]  1 = still water tile (pond/lake)
 *   pondLevel  — Float32Array[width*height] for still tiles: max heightmap elevation
 *                in that pond's connected component. 0 for non-still tiles.
 *                Use this to flatten all tiles in a pond to the same visual height.
 *   nearWater  — Uint8Array[width*height]  1 = land tile within 10 tiles of water
 *   currentStrength — Float32Array[width*height] 0..1 strength for moving water
 *                     tiles, 0 for still/non-water tiles
 *   valid      — boolean  true if nearWaterCount >= options.minNearWaterTiles
 *   stats      — { nMoving, nStill, nNearWater }
 * }
 */

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS = {
  // Number of entry points poured in from the high-elevation map edge.
  // Each gets its own independent fill up to budgetPerEntry tiles.
  numEntries: 3,

  // How many tiles each entry point is allowed to fill.
  // Larger = more water, wider rivers, larger ponds.
  budgetPerEntry: 1500,

  // Minimum separation between entry points (manhattan distance).
  minEntrySeparation: 45,

  // Flood-fill pond test threshold.
  // A water tile is classified as still (pond) if the farthest reachable
  // connected-water tile distance is <= pondMaxDistance. Otherwise river.
  // Search stops after pondSearchTileLimit connected water tiles.
  pondSearchTileLimit: 14,
  pondMaxDistance: 5,

  // Validation: minimum number of land tiles within 10 tiles of any water.
  // Generation retries with a seed variant until this is met or maxRetries exhausted.
  minNearWaterTiles: 10000,

  // How many seed variants to try before giving up and returning best attempt.
  maxRetries: 10,

  // Seed string used to deterministically pick entry points.
  // Pass your map seed here so water placement is reproducible.
  seed: 'default',
};

// ── PRNG (mulberry32) ─────────────────────────────────────────────────────────

function strToSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return h >>> 0;
}

function makePrng(seed) {
  let s = strToSeed(seed);
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul((s ^ (s >>> 15)), (1 | s));
    t = (t + Math.imul((t ^ (t >>> 7)), (61 | t))) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };
}

// ── Min-heap ──────────────────────────────────────────────────────────────────

class MinHeap {
  constructor() { this._h = []; }

  push(priority, value) {
    this._h.push([priority, value]);
    let i = this._h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._h[p][0] <= this._h[i][0]) break;
      [this._h[p], this._h[i]] = [this._h[i], this._h[p]];
      i = p;
    }
  }

  pop() {
    const top = this._h[0];
    const last = this._h.pop();
    if (this._h.length) {
      this._h[0] = last;
      let i = 0;
      while (true) {
        let s = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < this._h.length && this._h[l][0] < this._h[s][0]) s = l;
        if (r < this._h.length && this._h[r][0] < this._h[s][0]) s = r;
        if (s === i) break;
        [this._h[i], this._h[s]] = [this._h[s], this._h[i]];
        i = s;
      }
    }
    return top;
  }

  get size() { return this._h.length; }
}

// ── Entry point selection ─────────────────────────────────────────────────────

function pickEntries(h, width, height, rng, numEntries, minSep) {
  const cands = [];
  for (let x = 0; x < width; x++) {
    cands.push({ i: x,                       elev: h[x] });
    cands.push({ i: (height - 1) * width + x, elev: h[(height - 1) * width + x] });
  }
  for (let y = 1; y < height - 1; y++) {
    cands.push({ i: y * width,              elev: h[y * width] });
    cands.push({ i: y * width + width - 1,elev: h[y * width + width - 1] });
  }
  cands.sort((a, b) => b.elev - a.elev);
  const topQ = cands.slice(0, Math.floor(cands.length / 4));

  const chosen = [];
  for (const c of topQ) {
    if (chosen.length >= numEntries) break;
    const cy = Math.floor(c.i / width), cx = c.i % width;
    let ok = true;
    for (const e of chosen) {
      const ey = Math.floor(e / width), ex = e % width;
      if (Math.abs(cx - ex) + Math.abs(cy - ey) < minSep) { ok = false; break; }
    }
    if (ok && rng() < 0.85) chosen.push(c.i);
  }
  // Fallback: fill remaining slots without spacing constraint
  for (const c of topQ) {
    if (chosen.length >= numEntries) break;
    if (!chosen.includes(c.i)) chosen.push(c.i);
  }
  return chosen;
}

// ── Flood fill ────────────────────────────────────────────────────────────────

const CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function floodFill(h, width, height, entryIndex, budget) {
  const area = width * height;
  const water = new Uint8Array(area);
  const inQueue = new Uint8Array(area);
  const heap = new MinHeap();

  heap.push(h[entryIndex], entryIndex);
  inQueue[entryIndex] = 1;

  let placed = 0;
  while (heap.size > 0 && placed < budget) {
    const [, idx] = heap.pop();
    if (water[idx]) continue;
    water[idx] = 1;
    placed++;
    const y = Math.floor(idx / width), x = idx % width;
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (!inQueue[ni]) { heap.push(h[ni], ni); inQueue[ni] = 1; }
    }
  }
  return water;
}

// ── Flood-fill pond/river classification ──────────────────────────────────────

function classifyWater(water, width, height, pondSearchTileLimit, pondMaxDistance) {
  const area = width * height;
  const moving = new Uint8Array(area);
  const still = new Uint8Array(area);
  const visitedStamp = new Uint32Array(area);
  const distance = new Int16Array(area);
  const queue = [];
  const searchTileLimit = Math.max(1, Math.floor(Number(pondSearchTileLimit) || 1));
  const maxDistance = Math.max(0, Math.floor(Number(pondMaxDistance) || 0));
  let stamp = 1;

  for (let start = 0; start < area; start++) {
    if (!water[start]) {
      continue;
    }

    stamp += 1;
    if (stamp === 0) {
      visitedStamp.fill(0);
      stamp = 1;
    }

    queue.length = 0;
    queue.push(start);
    visitedStamp[start] = stamp;
    distance[start] = 0;

    let reachedCount = 1;
    let farthest = 0;
    let isPondCandidate = true;
    let head = 0;

    while (head < queue.length && isPondCandidate && reachedCount < searchTileLimit) {
      const cur = queue[head++];
      const curDist = distance[cur];
      const cy = Math.floor(cur / width);
      const cx = cur % width;

      for (const [dx, dy] of CARDINAL) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          continue;
        }
        const ni = ny * width + nx;
        if (!water[ni] || visitedStamp[ni] === stamp) {
          continue;
        }

        const nextDist = curDist + 1;
        reachedCount += 1;
        if (nextDist > farthest) {
          farthest = nextDist;
        }

        if (farthest > maxDistance) {
          isPondCandidate = false;
          break;
        }

        visitedStamp[ni] = stamp;
        distance[ni] = nextDist;
        queue.push(ni);

        if (reachedCount >= searchTileLimit) {
          break;
        }
      }
    }

    if (isPondCandidate) {
      still[start] = 1;
    } else {
      moving[start] = 1;
    }
  }

  return { moving, still };
}

// ── Pond level — max heightmap elevation per connected still-water component ──
//
// For each connected component of still tiles, find the highest h[] value
// in that component. Assign that value to every tile in the component via
// pondLevel[]. This is the "water surface elevation" — the game renderer
// can raise all tiles in a pond to this height so the surface looks flat.

function computePondLevels(still, h, width, height) {
  const area = width * height;
  const pondLevel = new Float32Array(area); // 0 = not a pond tile
  const visited = new Uint8Array(area);

  for (let start = 0; start < area; start++) {
    if (!still[start] || visited[start]) continue;

    // BFS to find the connected component
    const component = [];
    const queue = [start];
    visited[start] = 1;
    let maxElev = h[start];

    while (queue.length) {
      const cur = queue.shift();
      component.push(cur);
      if (h[cur] > maxElev) maxElev = h[cur];

      const cy = Math.floor(cur / width), cx = cur % width;
      for (const [dx, dy] of CARDINAL) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (still[ni] && !visited[ni]) { visited[ni] = 1; queue.push(ni); }
      }
    }

    // Stamp the max elevation onto every tile in this component
    for (const idx of component) pondLevel[idx] = maxElev;
  }

  return pondLevel;
}

// ── Near-water land count ─────────────────────────────────────────────────────

const NEAR_RADIUS = 10;

function computeNearWater(water, width, height) {
  const area = width * height;
  const near = new Uint8Array(area);
  const queue = [];

  for (let i = 0; i < area; i++) {
    if (water[i]) { near[i] = 1; queue.push({ i, dist: 0 }); }
  }

  let head = 0;
  while (head < queue.length) {
    const { i, dist } = queue[head++];
    if (dist >= NEAR_RADIUS) continue;
    const cy = Math.floor(i / width), cx = i % width;
    for (const [dx, dy] of CARDINAL) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (!near[ni]) { near[ni] = 1; queue.push({ i: ni, dist: dist + 1 }); }
    }
  }

  let count = 0;
  for (let i = 0; i < area; i++) if (near[i] && !water[i]) count++;
  return { near, count };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function computeCurrentStrength(moving, water, h, width, height) {
  const area = width * height;
  const currentStrength = new Float32Array(area);
  const radius = 2;
  const radiusSq = radius * radius;

  for (let i = 0; i < area; i++) {
    if (!moving[i]) {
      currentStrength[i] = 0;
      continue;
    }

    const y = Math.floor(i / width);
    const x = i % width;

    let neighborWater = 0;
    let sampled = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radiusSq) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        sampled += 1;
        if (water[ny * width + nx]) {
          neighborWater += 1;
        }
      }
    }

    const packedness = sampled > 0 ? (neighborWater / sampled) : 0;
    const narrowness = clamp01(1 - packedness);

    const baseElev = h[i];
    let maxDrop = 0;
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (!water[ni]) continue;
      const drop = baseElev - h[ni];
      if (drop > maxDrop) {
        maxDrop = drop;
      }
    }
    const gradient = clamp01(maxDrop * 6);

    const strength = clamp01((narrowness * 0.6) + (gradient * 0.4));
    currentStrength[i] = Math.max(0.05, Number(strength.toFixed(4)));
  }

  return currentStrength;
}

function buildEffectiveOptions(width, height, options) {
  const areaScale = Math.min(1, (width * height) / (300 * 300));
  const scaledBudget = Math.max(30, Math.round(options.budgetPerEntry * areaScale));
  const scaledNearWaterMin = Math.max(0, Math.round(options.minNearWaterTiles * areaScale));
  return {
    ...options,
    budgetPerEntry: scaledBudget,
    minNearWaterTiles: scaledNearWaterMin,
  };
}

// ── Single generation attempt ─────────────────────────────────────────────────

function attempt(h, width, height, opts, seedStr) {
  const rng = makePrng(seedStr);
  const entries = pickEntries(h, width, height, rng, opts.numEntries, opts.minEntrySeparation);

  // Each entry fills independently; results are unioned
  const area = width * height;
  const water = new Uint8Array(area);
  for (const entry of entries) {
    const filled = floodFill(h, width, height, entry, opts.budgetPerEntry);
    for (let i = 0; i < area; i++) if (filled[i]) water[i] = 1;
  }

  const { moving, still } = classifyWater(
    water,
    width,
    height,
    opts.pondSearchTileLimit,
    opts.pondMaxDistance,
  );
  const pondLevel = computePondLevels(still, h, width, height);
  const { near, count: nNearWater } = computeNearWater(water, width, height);
  const currentStrength = computeCurrentStrength(moving, water, h, width, height);

  let nMoving = 0, nStill = 0;
  for (let i = 0; i < area; i++) {
    if (moving[i]) nMoving++;
    if (still[i])  nStill++;
  }

  return {
    moving,
    still,
    pondLevel,
    currentStrength,
    nearWater: near,
    valid: nNearWater >= opts.minNearWaterTiles,
    stats: { nMoving, nStill, nNearWater },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * generateWater(heightmap, width, height, options?)
 *
 * @param {Float32Array} heightmap  Normalised [0,1] elevation values, row-major.
 * @param {number}       width      Map width.
 * @param {number}       height     Map height.
 * @param {object}       options    Partial options merged with DEFAULT_OPTIONS.
 * @returns {object}                See module header for output shape.
 */
function generateWater(heightmap, width, height, options = {}) {
  const safeWidth = Math.max(1, Math.floor(Number(width) || 1));
  const safeHeight = Math.max(1, Math.floor(Number(height) || 1));
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const opts = buildEffectiveOptions(safeWidth, safeHeight, merged);

  let result;
  for (let i = 0; i < opts.maxRetries; i++) {
    const seedStr = i === 0 ? opts.seed : `${opts.seed}_r${i}`;
    result = attempt(heightmap, safeWidth, safeHeight, opts, seedStr);
    if (result.valid) break;
  }

  return result;
}

module.exports = {
  DEFAULT_OPTIONS,
  generateWater,
  __testables: {
    classifyWater,
  },
};
