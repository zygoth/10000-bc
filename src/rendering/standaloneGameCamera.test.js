import { decayLookAhead2d, LOOKAHEAD_DECAY_TAU_MS } from './standaloneGameCamera.js';

describe('decayLookAhead2d', () => {
  it('returns unchanged offset when dt is zero', () => {
    expect(decayLookAhead2d(1, -0.5, 0, LOOKAHEAD_DECAY_TAU_MS)).toEqual({ x: 1, y: -0.5 });
  });

  it('decays toward zero with factor exp(-dt/tau)', () => {
    const tau = 500;
    const dt = 500;
    const k = Math.exp(-1);
    const out = decayLookAhead2d(2, 4, dt, tau);
    expect(out.x).toBeCloseTo(2 * k, 10);
    expect(out.y).toBeCloseTo(4 * k, 10);
  });

  it('zeros when tau is non-positive', () => {
    expect(decayLookAhead2d(3, 3, 100, 0)).toEqual({ x: 0, y: 0 });
  });
});
