import {
  buildInventoryGridItemTooltipTitle,
  computeSpoilageProgress,
  spoilageProgressToBarColor,
} from './inventorySlotDecayDryness.mjs';

const fmt = (kg) => `${kg}kg`;

describe('inventorySlotDecayDryness', () => {
  it('computeSpoilageProgress is 0 when fresh and 1 when expired', () => {
    expect(computeSpoilageProgress(5, 5)).toBeCloseTo(0, 5);
    expect(computeSpoilageProgress(0, 5)).toBeCloseTo(1, 5);
    expect(computeSpoilageProgress(2.5, 5)).toBeCloseTo(0.5, 5);
  });

  it('computeSpoilageProgress returns null without catalog days or remaining', () => {
    expect(computeSpoilageProgress(3, null)).toBeNull();
    expect(computeSpoilageProgress(null, 5)).toBeNull();
    expect(computeSpoilageProgress(3, 0)).toBeNull();
  });

  it('spoilageProgressToBarColor yields greenish then reddish', () => {
    expect(spoilageProgressToBarColor(0)).toMatch(/rgb\(/);
    const cold = spoilageProgressToBarColor(0);
    const hot = spoilageProgressToBarColor(1);
    expect(cold).not.toBe(hot);
  });

  it('buildInventoryGridItemTooltipTitle includes decay and dryness', () => {
    const t = buildInventoryGridItemTooltipTitle({
      name: 'Nut meat',
      totalWeightKg: 0.05,
      formatWeightLabel: fmt,
      decayDays: 10,
      decayDaysRemaining: 4.2,
      drynessPercent: 60,
      isFullyDried: false,
    });
    expect(t).toContain('Nut meat');
    expect(t).toContain('4.2 d until spoiled');
    expect(t).toContain('60%');
    expect(t).toContain('Base shelf life');
  });

  it('shows 0% dryness when canDry with null drynessPercent', () => {
    const t = buildInventoryGridItemTooltipTitle({
      name: 'Meat',
      totalWeightKg: 0.05,
      formatWeightLabel: fmt,
      canDry: true,
      drynessPercent: null,
      isFullyDried: false,
    });
    expect(t).toContain('0%');
  });
});
