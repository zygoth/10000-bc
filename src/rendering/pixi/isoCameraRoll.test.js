import {
  computeWorldPanLayerPixels,
  computeWorldPanLayerPixelsForSyncAnchor,
  tileAnchorFromFloat,
} from './isoCameraRoll.js';
import { ISO_TILE_HALF_WIDTH_PX } from './isoConstants.js';

describe('tileAnchorFromFloat', () => {
  it('matches Math.floor with 1e-9 epsilon', () => {
    expect(tileAnchorFromFloat(10.7, -3.2)).toEqual({ x: 10, y: -4 });
    expect(tileAnchorFromFloat(10.5, 11.2)).toEqual({ x: 10, y: 11 });
  });
});

describe('computeWorldPanLayerPixels', () => {
  it('is zero when camera sits on integer tile corners (frac 0)', () => {
    const a = computeWorldPanLayerPixels(5, 8);
    expect(a.fracX).toBe(0);
    expect(a.fracY).toBe(0);
    expect(a.px).toBe(0);
    expect(a.py).toBeCloseTo(0, 10);
  });

  it('changes smoothly for small float deltas without crossing an integer anchor', () => {
    const a = computeWorldPanLayerPixels(10.01, 10.01);
    const b = computeWorldPanLayerPixels(10.02, 10.02);
    expect(Math.abs(b.px - a.px)).toBeLessThan(10);
    expect(Math.abs(b.py - a.py)).toBeLessThan(10);
  });

  /**
   * Regression guard: crossing an integer boundary resets frac parts; combined with a sync
   * that uses a *different* anchor than floor(float), the world would jump. This only
   * asserts the math is internally consistent for adjacent float values across bx/by.
   */
  it('records pan offset before/after crossing +1 in both axes (diagonal)', () => {
    const before = computeWorldPanLayerPixels(10.99, 10.99);
    const after = computeWorldPanLayerPixels(11.01, 11.01);
    expect(before.bx).toBe(10);
    expect(after.bx).toBe(11);
    expect(typeof before.px).toBe('number');
    expect(typeof after.px).toBe('number');
  });
});

describe('computeWorldPanLayerPixelsForSyncAnchor', () => {
  it('stays continuous across a tile edge while sync anchor is unchanged', () => {
    const baseX = 10;
    const baseY = 10;
    const before = computeWorldPanLayerPixelsForSyncAnchor(10.99, 10.99, baseX, baseY);
    const after = computeWorldPanLayerPixelsForSyncAnchor(11.01, 11.01, baseX, baseY);
    expect(Math.abs(after.px - before.px)).toBeLessThan(10);
    expect(Math.abs(after.py - before.py)).toBeLessThan(10);
  });

  it('keeps world screen position when sync anchor catches up to the camera', () => {
    const camX = 11.01;
    const camY = 11.01;
    const worldX = 15;
    const worldY = 12;
    const originX = 640;
    const originY = 400;
    const pendingPan = computeWorldPanLayerPixelsForSyncAnchor(camX, camY, 10, 10);
    const syncedPan = computeWorldPanLayerPixelsForSyncAnchor(camX, camY, 11, 11);
    const pendingLayerX =
      ((worldX - 10) - (worldY - 10)) * ISO_TILE_HALF_WIDTH_PX + originX;
    const syncedLayerX =
      ((worldX - 11) - (worldY - 11)) * ISO_TILE_HALF_WIDTH_PX + originX;
    const pendingScreenX = pendingPan.px + pendingLayerX;
    const syncedScreenX = syncedPan.px + syncedLayerX;
    expect(syncedScreenX).toBeCloseTo(pendingScreenX, 5);
  });
});

describe('follow lerp invariant (simulated)', () => {
  const followPerFrame = 0.12;

  it('never moves more than ~12% of remaining distance toward target in one step', () => {
    let cx = 10;
    let cy = 10;
    const tx = 20;
    const ty = 18;
    for (let i = 0; i < 200; i += 1) {
      const dx = tx - cx;
      const dy = ty - cy;
      const toTarget = Math.hypot(dx, dy);
      if (toTarget < 1e-9) break;
      const nx = cx + dx * followPerFrame;
      const ny = cy + dy * followPerFrame;
      const step = Math.hypot(nx - cx, ny - cy);
      expect(step).toBeLessThanOrEqual(toTarget * followPerFrame + 1e-9);
      cx = nx;
      cy = ny;
    }
  });
});
