import {
  computeAmbientLoopCommands,
  computeMobileAmbientOneShots,
  pickWeightedCall,
  simulateMobileOneShotFrames,
} from './ambientPlayHeadless.mjs';

describe('pickWeightedCall', () => {
  test('respects pick_weight', () => {
    const entry = {
      calls: [
        { pick_weight: 0, url: '/a.ogg' },
        { pick_weight: 1, url: '/b.ogg' },
      ],
    };
    expect(pickWeightedCall(entry, () => 0.5).url).toBe('/b.ogg');
  });
});

describe('computeMobileAmbientOneShots (play pacing)', () => {
  const mobileEntry = {
    species_id: 'test_bird',
    scheduling: {
      min_seconds_between_calls_same_emitter: 0.6,
      min_seconds_between_calls_same_species: 0.15,
      mobile_roll_scale: 1,
    },
    day_activity: {
      kind: 'day_tick_segments',
      segments: [{ from_tick: 0, to_tick: 400, relative: 1 }],
    },
    calls: [{ pick_weight: 1, url: '/test.ogg', flight_call: false }],
  };

  const emitters = [{ speciesId: 'test_bird', x: 5, y: 5, index: 0 }];

  function rngTriplePass() {
    let i = 0;
    return () => {
      const v = i % 3;
      i += 1;
      if (v === 0) {
        return 0;
      }
      if (v === 1) {
        return 0.01;
      }
      return 0;
    };
  }

  test('cooldown blocks rapid repeat on same emitter tile', () => {
    const cd = new Map();
    const dt = 1 / 60;
    const rng = rngTriplePass();
    const base = {
      dtSec: dt,
      dayTick: 100,
      lx: 5,
      ly: 5,
      camX: 5.2,
      camY: 5.2,
      mobileEntries: [mobileEntry],
      emitters,
      cooldownUntil: cd,
      rng,
    };
    const a = computeMobileAmbientOneShots({ ...base, nowMs: 0 });
    expect(a.length).toBe(1);
    expect(cd.get('test_bird@5,5')).toBeGreaterThan(0);
    const b = computeMobileAmbientOneShots({ ...base, nowMs: 100 });
    expect(b.length).toBe(0);
    const c = computeMobileAmbientOneShots({ ...base, nowMs: 700 });
    expect(c.length).toBe(1);
  });

  test('one_shot_gain scales playback loudness', () => {
    const em = [{ speciesId: 'vol_test', x: 5, y: 5, index: 0 }];
    const mk = (gain) => ({
      species_id: 'vol_test',
      one_shot_gain: gain,
      scheduling: {
        min_seconds_between_calls_same_emitter: 0.1,
        min_seconds_between_calls_same_species: 0.1,
        mobile_roll_scale: 1,
      },
      day_activity: {
        kind: 'day_tick_segments',
        segments: [{ from_tick: 0, to_tick: 400, relative: 1 }],
      },
      calls: [{ pick_weight: 1, url: '/t.ogg', flight_call: false }],
    });
    const rng = () => 0.01;
    const a = computeMobileAmbientOneShots({
      nowMs: 0,
      dtSec: 1 / 60,
      dayTick: 200,
      lx: 5,
      ly: 5,
      camX: 5.2,
      camY: 5.2,
      mobileEntries: [mk(1)],
      emitters: em,
      cooldownUntil: new Map(),
      rng,
    });
    const b = computeMobileAmbientOneShots({
      nowMs: 0,
      dtSec: 1 / 60,
      dayTick: 200,
      lx: 5,
      ly: 5,
      camX: 5.2,
      camY: 5.2,
      mobileEntries: [mk(0.5)],
      emitters: em,
      cooldownUntil: new Map(),
      rng,
    });
    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
    expect(b[0].gain).toBeCloseTo(a[0].gain * 0.5, 5);
    expect(b[0].staticGainScale).toBeCloseTo(a[0].staticGainScale * 0.5, 5);
  });

  test('zero day_activity skips before roll (no sound)', () => {
    const quietEntry = {
      ...mobileEntry,
      day_activity: {
        kind: 'day_tick_segments',
        segments: [{ from_tick: 0, to_tick: 400, relative: 0 }],
      },
    };
    const cd = new Map();
    const out = computeMobileAmbientOneShots({
      nowMs: 0,
      dtSec: 1 / 60,
      dayTick: 50,
      lx: 5,
      ly: 5,
      camX: 5,
      camY: 5,
      mobileEntries: [quietEntry],
      emitters,
      cooldownUntil: cd,
      rng: () => 0,
    });
    expect(out.length).toBe(0);
  });

  test('simulateMobileOneShotFrames aggregates multi-frame play', () => {
    const cd = new Map();
    const rng = rngTriplePass();
    const state = { dayTick: 200 };
    const { batches } = simulateMobileOneShotFrames({
      frameCount: 120,
      dtSec: 0.05,
      startNowMs: 0,
      rng,
      state,
      camX: 5,
      camY: 5,
      mobileEntries: [mobileEntry],
      emitters,
    });
    const total = batches.reduce((n, b) => n + b.length, 0);
    expect(total).toBeGreaterThan(3);
    const gaps = [];
    let lastT = -1;
    for (let i = 0; i < batches.length; i += 1) {
      if (batches[i].length > 0) {
        const t = i * 0.05 * 1000;
        if (lastT >= 0) {
          gaps.push(t - lastT);
        }
        lastT = t;
      }
    }
    expect(gaps.some((g) => g >= 500)).toBe(true);
  });
});

describe('computeAmbientLoopCommands', () => {
  const campfire = {
    audio_role: 'camp_campfire',
    audibility: { requires_listener_in_camp_footprint: true },
    day_activity: { kind: 'day_tick_segments', segments: [{ from_tick: 0, to_tick: 400, relative: 1 }] },
    calls: [{ url: '/fire.ogg', pick_weight: 1, flight_call: false }],
  };

  test('campfire ensure when listener in footprint, stop when out', () => {
    const inState = {
      width: 20,
      height: 20,
      tiles: [],
      camp: { anchorX: 10, anchorY: 10 },
      dayTick: 50,
    };
    const inCmd = computeAmbientLoopCommands({
      state: inState,
      lx: 10,
      ly: 10,
      camX: 10,
      camY: 10,
      catalog: [campfire],
      dayTick: 50,
    });
    expect(inCmd.some((c) => c.op === 'ensure' && c.loopId === 'campfire')).toBe(true);

    const outCmd = computeAmbientLoopCommands({
      state: inState,
      lx: 0,
      ly: 0,
      camX: 0,
      camY: 0,
      catalog: [campfire],
      dayTick: 50,
    });
    expect(outCmd.some((c) => c.op === 'stop' && c.loopId === 'campfire')).toBe(true);
  });
});
