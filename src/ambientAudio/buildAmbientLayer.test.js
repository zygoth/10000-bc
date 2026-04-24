import { MAGICICADA_SPECIES_ID } from '../game/magicicadaEmergence.mjs';
import { buildYearWeightMaps, placeDailyEmitters } from './buildAmbientLayer.mjs';

describe('buildYearWeightMaps', () => {
  const mobileEntry = {
    species_id: 'p_test',
    audio_role: 'ambient_mobile',
    placement: { max_emitters_on_map: 5, max_emitters_per_tile: 1 },
    population_response: {
      base: 0.1,
      season_multiplier_by_key: { spring: 1, summer: 1, fall: 1, winter: 1 },
      terms: [
        { feature: 'moisture', kind: 'trapezoid', peak_at: 0.6, half_width: 0.2, floor: 0.05, ceiling: 1 },
      ],
      weight_clamp: [0, 20],
    },
  };

  function gridState(moistureHighAtIndex) {
    const w = 3;
    const h = 2;
    const tiles = [];
    for (let i = 0; i < w * h; i += 1) {
      const x = i % w;
      const y = Math.floor(i / w);
      tiles.push({
        x,
        y,
        moisture: i === moistureHighAtIndex ? 0.65 : 0.1,
        shade: 0.2,
        elevation: 0.5,
        waterType: null,
        plantIds: [],
        deadLog: false,
        rockType: null,
      });
    }
    return {
      width: w,
      height: h,
      tiles,
      plants: {},
      seed: 1,
      totalDaysSimulated: 1,
      dayOfYear: 5,
    };
  }

  test('higher moisture tile gets higher weight', () => {
    const maps = buildYearWeightMaps(gridState(4), [mobileEntry]);
    const arr = maps.get('p_test');
    expect(arr).toBeDefined();
    expect(arr[4]).toBeGreaterThan(arr[0]);
  });

  test('catalog snake_case feature keys (e.g. water_type enum) resolve and keep weights non-zero on land', () => {
    const entry = {
      species_id: 'snake_test',
      audio_role: 'ambient_mobile',
      placement: { max_emitters_on_map: 1, max_emitters_per_tile: 1 },
      population_response: {
        base: 0.1,
        season_multiplier_by_key: { spring: 1, summer: 1, fall: 1, winter: 1 },
        terms: [
          { feature: 'moisture', kind: 'trapezoid', peak_at: 0.5, half_width: 0.5, floor: 0.2, ceiling: 1 },
          { feature: 'water_type', kind: 'enum_weight', weights: { pond: 0, river: 0, land: 1 } },
        ],
        weight_clamp: [0, 20],
      },
    };
    const tile = {
      x: 0,
      y: 0,
      moisture: 0.5,
      shade: 0.3,
      elevation: 0.4,
      waterType: null,
      plantIds: [],
      deadLog: false,
      rockType: null,
    };
    const state = {
      width: 1,
      height: 1,
      tiles: [tile],
      plants: {},
      seed: 1,
      dayOfYear: 5,
      totalDaysSimulated: 1,
    };
    const maps = buildYearWeightMaps(state, [entry]);
    const arr = maps.get('snake_test');
    expect(arr[0]).toBeGreaterThan(0.01);
  });

  test('plant affinity increases weight near target plant', () => {
    const entry = {
      species_id: 'bird_test',
      audio_role: 'ambient_mobile',
      placement: { max_emitters_on_map: 2, max_emitters_per_tile: 1 },
      population_response: {
        base: 0.1,
        season_multiplier_by_key: { spring: 1, summer: 1, fall: 1, winter: 1 },
        terms: [
          {
            kind: 'plant_affinity_neighbors',
            target_plant_species_ids: ['test_plant'],
            max_distance: 2,
            at_distance_0: 2,
            beyond_max: 0.5,
          },
        ],
        weight_clamp: [0, 50],
      },
    };
    const w = 5;
    const h = 1;
    const tiles = [];
    for (let x = 0; x < w; x += 1) {
      tiles.push({
        x,
        y: 0,
        moisture: 0.5,
        shade: 0.3,
        elevation: 0.5,
        waterType: null,
        plantIds: x === 2 ? ['pl1'] : [],
        deadLog: false,
        rockType: null,
      });
    }
    const state = {
      width: w,
      height: h,
      tiles,
      plants: { pl1: { speciesId: 'test_plant' } },
      seed: 1,
      totalDaysSimulated: 1,
      dayOfYear: 3,
    };
    const maps = buildYearWeightMaps(state, [entry]);
    const arr = maps.get('bird_test');
    expect(arr[2]).toBeGreaterThan(arr[0]);
    expect(arr[1]).toBeGreaterThan(arr[0]);
  });

  test('omits magicicada weight map when not emergence year; includes when Brood year', () => {
    const pEntry = {
      species_id: 'p_test',
      audio_role: 'ambient_mobile',
      placement: { max_emitters_on_map: 1, max_emitters_per_tile: 1 },
      population_response: {
        base: 0.1,
        season_multiplier_by_key: { spring: 1, summer: 1, fall: 1, winter: 1 },
        terms: [
          { feature: 'moisture', kind: 'trapezoid', peak_at: 0.5, half_width: 0.5, floor: 0.2, ceiling: 1 },
        ],
        weight_clamp: [0, 20],
      },
    };
    const cicadaEntry = {
      species_id: MAGICICADA_SPECIES_ID,
      audio_role: 'ambient_mobile',
      population_response: {
        base: 0.5,
        season_multiplier_by_key: { spring: 1, summer: 1, fall: 1, winter: 1 },
        terms: [],
        weight_clamp: [0, 10],
      },
    };
    const base = gridState(0);
    const off = { ...base, year: 1, magicicadaSeptendecimEmergenceOffset: 0 };
    const mapsOff = buildYearWeightMaps(off, [pEntry, cicadaEntry]);
    expect(mapsOff.get(MAGICICADA_SPECIES_ID)).toBeUndefined();
    expect(mapsOff.get('p_test')).toBeDefined();

    const on = { ...base, year: 17, magicicadaSeptendecimEmergenceOffset: 0 };
    const mapsOn = buildYearWeightMaps(on, [pEntry, cicadaEntry]);
    expect(mapsOn.get(MAGICICADA_SPECIES_ID)).toBeDefined();
  });

  test('non-periodical cicada gets weight map every year while magicicada is omitted off-year', () => {
    const annualCicadaEntry = {
      species_id: 'neotibicen_canicularis',
      audio_role: 'ambient_mobile',
      placement: { max_emitters_on_map: 1, max_emitters_per_tile: 1 },
      population_response: {
        base: 0.1,
        season_multiplier_by_key: { spring: 1, summer: 1, fall: 1, winter: 1 },
        terms: [
          { feature: 'moisture', kind: 'trapezoid', peak_at: 0.5, half_width: 0.5, floor: 0.2, ceiling: 1 },
        ],
        weight_clamp: [0, 20],
      },
    };
    const cicadaEntry = {
      species_id: MAGICICADA_SPECIES_ID,
      audio_role: 'ambient_mobile',
      population_response: {
        base: 0.5,
        season_multiplier_by_key: { spring: 1, summer: 1, fall: 1, winter: 1 },
        terms: [],
        weight_clamp: [0, 10],
      },
    };
    const base = { ...gridState(0) };
    const off = { ...base, year: 1, magicicadaSeptendecimEmergenceOffset: 0 };
    const maps = buildYearWeightMaps(off, [annualCicadaEntry, cicadaEntry]);
    expect(maps.get('neotibicen_canicularis')).toBeDefined();
    expect(maps.get(MAGICICADA_SPECIES_ID)).toBeUndefined();
  });
});

describe('placeDailyEmitters', () => {
  const mobileEntry = {
    species_id: 'e_test',
    audio_role: 'ambient_mobile',
    placement: { max_emitters_on_map: 4, max_emitters_per_tile: 2 },
    population_response: { base: 1, terms: [], season_multiplier_by_key: {} },
  };

  test('deterministic placement for same day seed and weights', () => {
    const w = 3;
    const area = 9;
    const weights = new Float32Array(area);
    for (let i = 0; i < area; i += 1) {
      weights[i] = 1 + i * 0.01;
    }
    const maps = new Map([['e_test', weights]]);
    const a = placeDailyEmitters(maps, [mobileEntry], 11, 999, w);
    const b = placeDailyEmitters(maps, [mobileEntry], 11, 999, w);
    expect(a).toEqual(b);
    expect(a.length).toBe(4);
    expect(a.every((e) => e.speciesId === 'e_test')).toBe(true);
  });

  test('different sim day changes emitter positions with same weights', () => {
    const w = 4;
    const area = 16;
    const weights = new Float32Array(area);
    weights.fill(1);
    const maps = new Map([['e_test', weights]]);
    const a = placeDailyEmitters(maps, [mobileEntry], 3, 100, w);
    const b = placeDailyEmitters(maps, [mobileEntry], 4, 100, w);
    expect(a).not.toEqual(b);
  });

  test('respects max_emitters_per_tile', () => {
    const w = 2;
    const area = 4;
    const weights = new Float32Array(area);
    weights.fill(10);
    const entry = {
      ...mobileEntry,
      placement: { max_emitters_on_map: 10, max_emitters_per_tile: 1 },
    };
    const maps = new Map([['e_test', weights]]);
    const out = placeDailyEmitters(maps, [entry], 1, 1, w);
    const byTile = new Map();
    for (const e of out) {
      const k = `${e.x},${e.y}`;
      byTile.set(k, (byTile.get(k) || 0) + 1);
    }
    for (const c of byTile.values()) {
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});
