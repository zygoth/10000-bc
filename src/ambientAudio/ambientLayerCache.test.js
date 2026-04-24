import { getAmbientYearBucket, syncAmbientLayerCache } from './ambientLayerCache.mjs';

describe('getAmbientYearBucket', () => {
  test('40-day years from totalDaysSimulated', () => {
    expect(getAmbientYearBucket(0)).toBe(0);
    expect(getAmbientYearBucket(1)).toBe(0);
    expect(getAmbientYearBucket(40)).toBe(0);
    expect(getAmbientYearBucket(41)).toBe(1);
    expect(getAmbientYearBucket(80)).toBe(1);
    expect(getAmbientYearBucket(81)).toBe(2);
  });
});

describe('syncAmbientLayerCache', () => {
  const mobileEntry = {
    species_id: 'test_species',
    audio_role: 'ambient_mobile',
    placement: { max_emitters_on_map: 3, max_emitters_per_tile: 2 },
    population_response: {
      base: 0.2,
      season_multiplier_by_key: { spring: 1, summer: 1, fall: 1, winter: 1 },
      terms: [
        { feature: 'moisture', kind: 'trapezoid', peak_at: 0.5, half_width: 0.5, floor: 0.1, ceiling: 1 },
      ],
      weight_clamp: [0, 99],
    },
  };

  function makeState(tds, dayOfYear, seed = 42, year = 1) {
    const w = 4;
    const h = 3;
    const tiles = [];
    for (let i = 0; i < w * h; i += 1) {
      const x = i % w;
      const y = Math.floor(i / w);
      tiles.push({
        x,
        y,
        moisture: 0.55,
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
      seed,
      year,
      totalDaysSimulated: tds,
      dayOfYear: dayOfYear || 1,
    };
  }

  test('rebuilds weight maps on each new sim day (dayOfYear change) and re-places emitters', () => {
    const a = syncAmbientLayerCache(makeState(5, 5), [mobileEntry], {});
    expect(a.weightsRebuilt).toBe(true);
    const wRef = a.weightMaps;
    const b = syncAmbientLayerCache(makeState(6, 6), [mobileEntry], {
      cacheYearBucket: a.cacheYearBucket,
      cacheGameYear: a.cacheGameYear,
      cacheDayOfYear: a.cacheDayOfYear,
      cacheDay: a.cacheDay,
      weightMaps: a.weightMaps,
      emitters: a.emitters,
    });
    expect(b.weightsRebuilt).toBe(true);
    expect(b.weightMaps).not.toBe(wRef);
    expect(b.emitters).not.toBe(a.emitters);
  });

  test('rebuilds weight maps on year boundary and re-places emitters', () => {
    const a = syncAmbientLayerCache(makeState(40, 40), [mobileEntry], {});
    const w40 = a.weightMaps;
    const b = syncAmbientLayerCache(makeState(41, 1), [mobileEntry], {
      cacheYearBucket: a.cacheYearBucket,
      cacheGameYear: a.cacheGameYear,
      cacheDayOfYear: a.cacheDayOfYear,
      cacheDay: a.cacheDay,
      weightMaps: a.weightMaps,
      emitters: a.emitters,
    });
    expect(b.weightsRebuilt).toBe(true);
    expect(b.weightMaps).not.toBe(w40);
    expect(b.cacheYearBucket).toBe(1);
  });

  test('intraday second sync keeps caches stable', () => {
    const s = makeState(7, 10);
    const a = syncAmbientLayerCache(s, [mobileEntry], {});
    const b = syncAmbientLayerCache(s, [mobileEntry], {
      cacheYearBucket: a.cacheYearBucket,
      cacheGameYear: a.cacheGameYear,
      cacheDayOfYear: a.cacheDayOfYear,
      cacheDay: a.cacheDay,
      weightMaps: a.weightMaps,
      emitters: a.emitters,
    });
    expect(b.weightMaps).toBe(a.weightMaps);
    expect(b.emitters).toBe(a.emitters);
    expect(b.weightsRebuilt).toBe(false);
  });

  test('rebuilds weight maps when state.year changes but ambient bucket unchanged', () => {
    const a = syncAmbientLayerCache(makeState(5, 5, 42, 1), [mobileEntry], {});
    const wRef = a.weightMaps;
    const b = syncAmbientLayerCache(makeState(5, 5, 42, 2), [mobileEntry], {
      cacheYearBucket: a.cacheYearBucket,
      cacheGameYear: a.cacheGameYear,
      cacheDayOfYear: a.cacheDayOfYear,
      cacheDay: a.cacheDay,
      weightMaps: a.weightMaps,
      emitters: a.emitters,
    });
    expect(b.weightsRebuilt).toBe(true);
    expect(b.weightMaps).not.toBe(wRef);
    expect(b.cacheGameYear).toBe(2);
  });
});
