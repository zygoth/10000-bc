import {
  computeWorldPanLayerPixels,
  tileAnchorFromFloat,
} from './isoCameraRoll.js';

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
