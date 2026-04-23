import {
  defaultPatchCapacityForMaxSize,
  LIFE_STAGE_VISUAL_SCALE_MIN,
  lifeStageSizeVisualScaleMultiplier,
  patchSpriteScaleForCapacity,
  resolvePatchCapacity,
  resolvePatchLayout,
} from './plantPatchLayout.mjs';

describe('plantPatchLayout', () => {
  it('uses inferred capacity mapping by species max size only', () => {
    expect(defaultPatchCapacityForMaxSize(1)).toBe(9);
    expect(defaultPatchCapacityForMaxSize(2)).toBe(4);
    expect(defaultPatchCapacityForMaxSize(3)).toBe(4);
    expect(defaultPatchCapacityForMaxSize(4)).toBe(2);
    expect(defaultPatchCapacityForMaxSize(6)).toBe(1);
  });

  it('prefers max_plants_per_tile override when present', () => {
    const species = {
      maxPlantsPerTile: 7,
      lifeStages: [{ stage: 'seedling', size: 1 }, { stage: 'mature', size: 9 }],
    };
    const plant = { stageName: 'seedling' };
    expect(resolvePatchCapacity(species, plant)).toBe(7);
  });

  it('ignores null/empty overrides and falls back to inferred capacity', () => {
    const species = {
      maxPlantsPerTile: null,
      lifeStages: [{ stage: 'seedling', size: 1 }, { stage: 'mature', size: 3 }],
    };
    const plant = { stageName: 'seedling' };
    expect(resolvePatchCapacity(species, plant)).toBe(4);
  });

  it('keeps seedlings at max-size-derived capacity', () => {
    const species = {
      maxPlantsPerTile: null,
      lifeStages: [
        { stage: 'seedling', size: 1 },
        { stage: 'vegetative', size: 2 },
        { stage: 'flowering', size: 4 },
      ],
    };
    const seedlingPlant = { stageName: 'seedling' };
    expect(resolvePatchCapacity(species, seedlingPlant)).toBe(2);
  });

  it('returns deterministic layout and minimum spacing constraints', () => {
    const minSpacingPx = 3;
    const one = resolvePatchLayout(4, 'x,y:plant_1', { radiusPx: 10, minSpacingPx });
    const two = resolvePatchLayout(4, 'x,y:plant_1', { radiusPx: 10, minSpacingPx });
    expect(two).toEqual(one);
    expect(one).toHaveLength(4);
    for (let i = 0; i < one.length; i += 1) {
      for (let j = i + 1; j < one.length; j += 1) {
        const dx = one[i].x - one[j].x;
        const dy = one[i].y - one[j].y;
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(minSpacingPx * 0.72);
      }
    }
  });

  it('keeps multi-copy patch centered on tile anchor', () => {
    const layout = resolvePatchLayout(2, 'center-check', { radiusPx: 12, minSpacingPx: 4 });
    expect(layout).toHaveLength(2);
    const avgX = (layout[0].x + layout[1].x) / 2;
    const avgY = (layout[0].y + layout[1].y) / 2;
    expect(Math.abs(avgX)).toBeLessThan(0.02);
    expect(Math.abs(avgY)).toBeLessThan(0.02);
  });

  it('uses half-size sprite scale for 2x2 patch layout on non-giants', () => {
    expect(patchSpriteScaleForCapacity(4, 3, 1)).toBeCloseTo(0.5, 6);
    expect(patchSpriteScaleForCapacity(4, 5, 1)).toBeCloseTo(1, 6);
  });

  it('maps life-stage size 1–10 to a linear visual multiplier', () => {
    expect(lifeStageSizeVisualScaleMultiplier(1)).toBeCloseTo(LIFE_STAGE_VISUAL_SCALE_MIN, 6);
    const mid = LIFE_STAGE_VISUAL_SCALE_MIN + (4 / 9) * (1 - LIFE_STAGE_VISUAL_SCALE_MIN);
    expect(lifeStageSizeVisualScaleMultiplier(5)).toBeCloseTo(mid, 6);
    expect(lifeStageSizeVisualScaleMultiplier(10)).toBeCloseTo(1.0, 6);
  });

  it('clamps life-stage visual multiplier to sizes 1–10', () => {
    expect(lifeStageSizeVisualScaleMultiplier(0)).toBeCloseTo(lifeStageSizeVisualScaleMultiplier(1), 6);
    expect(lifeStageSizeVisualScaleMultiplier(-3)).toBeCloseTo(lifeStageSizeVisualScaleMultiplier(1), 6);
    expect(lifeStageSizeVisualScaleMultiplier(15)).toBeCloseTo(lifeStageSizeVisualScaleMultiplier(10), 6);
  });
});
