import { evaluatePopulationTerm, evaluatePopulationResponse } from './populationTerms.mjs';
import { buildTileFeatureSnapshot } from './tileFeatures.mjs';

describe('populationTerms', () => {
  test('trapezoid peaks at moisture', () => {
    const snap = { moisture: 0.5, shade: 0, waterType: 'land', plantPresent: false, rock: false };
    const f = evaluatePopulationTerm(snap, {
      kind: 'trapezoid',
      feature: 'moisture',
      peak_at: 0.5,
      half_width: 0.2,
      floor: 0.1,
      ceiling: 1,
    }, { state: null, centerX: 0, centerY: 0 });
    expect(f).toBeGreaterThan(0.9);
    const dry = evaluatePopulationTerm(
      { ...snap, moisture: 0.02 },
      {
        kind: 'trapezoid',
        feature: 'moisture',
        peak_at: 0.5,
        half_width: 0.2,
        floor: 0.1,
        ceiling: 1,
      },
      { state: null, centerX: 0, centerY: 0 },
    );
    expect(dry).toBeLessThan(0.2);
  });

  test('plant affinity boosts near target species', () => {
    const state = {
      width: 5,
      height: 5,
      tiles: Array(25).fill(null).map((_, i) => ({
        x: i % 5,
        y: Math.floor(i / 5),
        plantIds: i === 12 ? ['p1'] : [],
        moisture: 0.5,
        shade: 0.3,
        waterType: null,
        elevation: 0.5,
      })),
      plants: {
        p1: { speciesId: 'asclepias_syriaca', x: 2, y: 2 },
      },
    };
    const tile = state.tiles[0];
    const snap = buildTileFeatureSnapshot(tile, state, 0, 0);
    const ctx = { state, centerX: 0, centerY: 0 };
    const term = {
      kind: 'plant_affinity_neighbors',
      target_plant_species_ids: ['asclepias_syriaca'],
      max_distance: 4,
      at_distance_0: 1.5,
      beyond_max: 0.8,
    };
    const f = evaluatePopulationTerm(snap, term, ctx);
    expect(f).toBeGreaterThan(1);
  });

  test('evaluatePopulationResponse applies season multiplier', () => {
    const entry = {
      population_response: {
        base: 0.1,
        season_multiplier_by_key: { spring: 2, summer: 1, fall: 1, winter: 1 },
        terms: [],
      },
    };
    const snap = { moisture: 0.5, shade: 0.2, waterType: 'land', plantPresent: true, rock: false };
    const w = evaluatePopulationResponse(entry, snap, { state: {}, centerX: 0, centerY: 0 }, 'spring', 1);
    expect(w).toBeCloseTo(0.2, 5);
  });

  test('calendar_timeline day_segments overrides season when present', () => {
    const entry = {
      population_response: {
        base: 1,
        season_multiplier_by_key: { spring: 2, summer: 1, fall: 1, winter: 0 },
        calendar_timeline: {
          kind: 'day_segments',
          default_relative: 0,
          segments: [
            { from_day: 5, to_day: 8, relative: 0.5 },
            { from_day: 9, to_day: 20, relative: 1 },
          ],
        },
        terms: [],
      },
    };
    const snap = { moisture: 0.5, shade: 0.2, waterType: 'land' };
    const ctx = { state: {}, centerX: 0, centerY: 0 };
    expect(evaluatePopulationResponse(entry, snap, ctx, 'spring', 3)).toBe(0);
    expect(evaluatePopulationResponse(entry, snap, ctx, 'winter', 3)).toBe(0);
    expect(evaluatePopulationResponse(entry, snap, ctx, 'spring', 7)).toBe(0.5);
    expect(evaluatePopulationResponse(entry, snap, ctx, 'winter', 10)).toBe(1);
  });
});
