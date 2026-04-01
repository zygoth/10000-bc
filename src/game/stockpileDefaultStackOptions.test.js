import { buildDefaultCampStockpileStackFields } from './stockpileDefaultStackOptions.mjs';

describe('buildDefaultCampStockpileStackFields', () => {
  it('sets plant-part decay and unit weight from catalog', () => {
    const fields = buildDefaultCampStockpileStackFields('juglans_nigra:husked_nut:whole');
    expect(fields.footprintW).toBe(1);
    expect(fields.footprintH).toBe(1);
    expect(fields.decayDaysRemaining).toBe(300);
    expect(fields.unitWeightKg).toBeCloseTo(0.025);
    expect(fields.tanninRemaining).toBeUndefined();
  });

  it('matches land trap carcass metadata', () => {
    const fields = buildDefaultCampStockpileStackFields('sylvilagus_floridanus:carcass');
    expect(fields.freshness).toBe(1);
    expect(fields.decayDaysRemaining).toBe(3);
    expect(fields.unitWeightKg).toBeCloseTo(0.9);
  });

  it('assigns weight to synthetic inner bark for test bootstrap', () => {
    const fields = buildDefaultCampStockpileStackFields('bark:inner_bark');
    expect(fields.unitWeightKg).toBeCloseTo(0.04);
  });

  it('uses fish meat decay for fish_carcass', () => {
    const fields = buildDefaultCampStockpileStackFields('catostomus_commersonii:fish_carcass');
    expect(fields.freshness).toBe(1);
    expect(fields.decayDaysRemaining).toBe(2);
    expect(fields.unitWeightKg).toBeCloseTo(0.001);
  });

  it('sets item catalog decay and weight when present', () => {
    const fields = buildDefaultCampStockpileStackFields('earthworm');
    expect(fields.decayDaysRemaining).toBe(1);
    expect(fields.unitWeightKg).toBeGreaterThan(0);
  });

  it('uses ITEM_FOOTPRINT_OVERRIDES when present (matches resolveItemFootprint)', () => {
    const fields = buildDefaultCampStockpileStackFields('tool:coat');
    expect(fields.footprintW).toBe(2);
    expect(fields.footprintH).toBe(2);
  });
});
