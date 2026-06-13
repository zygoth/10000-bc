import {
  pickPointOnEdge,
  pickRandomUpwindSpawnPoint,
  pickUpwindEdges,
  spawnPointsOnAllUpwindEdges,
  windUnitVector,
} from './windDustSpawn.mjs';
import { computeScreenViewportBounds } from './windDustViewport.mjs';

describe('windDustSpawn', () => {
  it('windUnitVector uses angleRadians when present', () => {
    const v = windUnitVector({ angleRadians: 0, x: 0, y: 0 });
    expect(v.x).toBeCloseTo(1, 5);
    expect(v.y).toBeCloseTo(0, 5);
  });

  it('pickUpwindEdges returns two edges for diagonal wind', () => {
    const edges = pickUpwindEdges({ x: 0.707, y: 0.707 });
    expect(edges).toContain('left');
    expect(edges).toContain('top');
    expect(edges).toHaveLength(2);
  });

  it('spawnPointsOnAllUpwindEdges returns one point on each upwind edge', () => {
    const bounds = { minX: 100, maxX: 500, minY: 80, maxY: 400 };
    const windDir = { x: 1, y: 0.5 };
    const pts = spawnPointsOnAllUpwindEdges(windDir, bounds, 30, () => 0.5);
    expect(pts).toHaveLength(2);
    expect(pts.map((p) => p.edge).sort()).toEqual(['left', 'top']);
  });

  it('pickRandomUpwindSpawnPoint lands on an upwind edge', () => {
    const bounds = computeScreenViewportBounds(800, 600, 0);
    const windDir = { x: 0.9, y: 0.4 };
    const pt = pickRandomUpwindSpawnPoint(windDir, bounds, 20, () => 0.25);
    const onLeft = pt.x <= bounds.minX;
    const onTop = pt.y <= bounds.minY;
    expect(onLeft || onTop).toBe(true);
  });

  it('pickPointOnEdge covers full edge length', () => {
    const bounds = { minX: 0, maxX: 200, minY: 0, maxY: 100 };
    const start = pickPointOnEdge('top', bounds, 10, 0);
    const end = pickPointOnEdge('top', bounds, 10, 1);
    expect(start.x).toBe(0);
    expect(end.x).toBe(200);
    expect(start.y).toBe(-10);
  });
});
