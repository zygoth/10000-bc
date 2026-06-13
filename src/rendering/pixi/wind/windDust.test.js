import { isWindCalm } from './windStrengthField.mjs';
import { BASE_DRIFT_PX_PER_SEC, POOL_SIZE } from './windDust.js';

describe('windDust helpers', () => {
  it('exports a fixed particle pool size', () => {
    expect(POOL_SIZE).toBeGreaterThanOrEqual(32);
  });

  it('exports a positive base drift speed', () => {
    expect(BASE_DRIFT_PX_PER_SEC).toBeGreaterThan(0);
  });

  it('treats sub-0.2 strength as calm (no dust)', () => {
    expect(isWindCalm(0.1)).toBe(true);
    expect(isWindCalm(0.25)).toBe(false);
  });
});
