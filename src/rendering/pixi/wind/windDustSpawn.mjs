const EDGE_EPS = 0.08;

/**
 * @param {{ x: number, y: number }} windDir unit vector (wind blows in this direction)
 * @returns {Array<'left' | 'right' | 'top' | 'bottom'>}
 */
export function pickUpwindEdges(windDir) {
  const edges = [];
  if (windDir.x > EDGE_EPS) {
    edges.push('left');
  } else if (windDir.x < -EDGE_EPS) {
    edges.push('right');
  }
  if (windDir.y > EDGE_EPS) {
    edges.push('top');
  } else if (windDir.y < -EDGE_EPS) {
    edges.push('bottom');
  }
  if (edges.length === 0) {
    edges.push(windDir.x >= 0 ? 'left' : 'right');
  }
  return edges;
}

/**
 * Random point on one upwind edge (for recycling a single particle).
 * @param {{ x: number, y: number }} windDir
 * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
 * @param {number} pad
 * @param {() => number} rng
 */
export function pickRandomUpwindSpawnPoint(windDir, bounds, pad, rng) {
  const edges = pickUpwindEdges(windDir);
  const edge = edges[Math.floor(rng() * edges.length)];
  return pickPointOnEdge(edge, bounds, pad, rng());
}

/**
 * Random point along a single upwind edge (u = 0..1 along that edge).
 * @param {'left' | 'right' | 'top' | 'bottom'} edge
 * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
 * @param {number} pad
 * @param {number} u 0..1 position along the edge
 */
export function pickPointOnEdge(edge, bounds, pad, u) {
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const t = Math.max(0, Math.min(1, Number(u) || 0));
  switch (edge) {
    case 'left':
      return { x: bounds.minX - pad, y: bounds.minY + t * h };
    case 'right':
      return { x: bounds.maxX + pad, y: bounds.minY + t * h };
    case 'top':
      return { x: bounds.minX + t * w, y: bounds.minY - pad };
    case 'bottom':
    default:
      return { x: bounds.minX + t * w, y: bounds.maxY + pad };
  }
}

/**
 * One spawn point per upwind edge — diagonal wind spawns on both edges every call.
 * @param {{ x: number, y: number }} windDir
 * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
 * @param {number} pad
 * @param {() => number} rng 0..1
 * @returns {Array<{ x: number, y: number, edge: string }>}
 */
export function spawnPointsOnAllUpwindEdges(windDir, bounds, pad, rng) {
  return pickUpwindEdges(windDir).map((edge) => ({
    edge,
    ...pickPointOnEdge(edge, bounds, pad, rng()),
  }));
}

/**
 * @param {{ x?: number, y?: number, angleRadians?: number }} windVector
 */
export function windUnitVector(windVector) {
  const angle = Number.isFinite(Number(windVector?.angleRadians))
    ? Number(windVector.angleRadians)
    : Math.atan2(Number(windVector?.y) || 0, Number(windVector?.x) || 0);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

