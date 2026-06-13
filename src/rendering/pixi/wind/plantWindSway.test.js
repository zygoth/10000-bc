import { lifeStageSizeVisualScaleMultiplier } from '../../../game/plantPatchLayout.mjs';
import {
  resolveSwayMode,
  resolveSilhouetteAspect,
  sizeSwayFactor,
  swayPhaseOffset,
  SWAY_MODE,
  SWAY_SILHOUETTE_PIVOT_THRESHOLD,
} from './plantWindSway.mjs';

describe('plantWindSway', () => {
  it('resolveSwayMode forces squash for center-anchored sprites', () => {
    expect(resolveSwayMode({ centerAnchored: true, silhouetteAspect: 2.5 })).toBe(SWAY_MODE.SQUASH);
  });

  it('resolveSwayMode picks pivot for tall silhouettes', () => {
    expect(resolveSwayMode({ silhouetteAspect: SWAY_SILHOUETTE_PIVOT_THRESHOLD })).toBe(SWAY_MODE.PIVOT);
    expect(resolveSwayMode({ silhouetteAspect: 2.0 })).toBe(SWAY_MODE.PIVOT);
  });

  it('resolveSwayMode picks squash for wide silhouettes', () => {
    expect(resolveSwayMode({ silhouetteAspect: 1.0 })).toBe(SWAY_MODE.SQUASH);
    expect(resolveSwayMode({ opaqueW: 40, opaqueH: 30 })).toBe(SWAY_MODE.SQUASH);
  });

  it('resolveSilhouetteAspect prefers catalog opaque bounds', () => {
    expect(resolveSilhouetteAspect({ opaqueW: 20, opaqueH: 50 })).toBeCloseTo(2.5, 5);
    expect(resolveSilhouetteAspect({ silhouetteAspect: 1.8 })).toBe(1.8);
  });

  it('sizeSwayFactor gives seedlings more sway than mature large plants', () => {
    const seedling = sizeSwayFactor(1);
    const mature = sizeSwayFactor(10);
    const mid = sizeSwayFactor(5);
    expect(seedling).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(mature);
    expect(seedling).toBeCloseTo(1 / lifeStageSizeVisualScaleMultiplier(1), 5);
    expect(mature).toBeCloseTo(
      (1 / lifeStageSizeVisualScaleMultiplier(10)) * 0.22,
      5,
    );
  });

  it('swayPhaseOffset is stable per plant id', () => {
    expect(swayPhaseOffset('plant-42')).toBe(swayPhaseOffset('plant-42'));
    expect(swayPhaseOffset('plant-42')).not.toBe(swayPhaseOffset('plant-43'));
  });
});
