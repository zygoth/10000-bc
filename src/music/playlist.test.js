import {
  buildSeasonOrder,
  clampResumeTimeSec,
  crossfadeVolumes,
  fisherYatesShuffle,
  nextFromOrder,
  normalizePathForMatch,
} from './playlist.mjs';

describe('fisherYatesShuffle', () => {
  test('is permutation', () => {
    const seq = [1, 2, 3, 4, 5];
    let c = 0;
    const rng = () => {
      c = (c + 0.31) % 1;
      return c;
    };
    const out = fisherYatesShuffle(seq, rng);
    expect(out.length).toBe(5);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('buildSeasonOrder', () => {
  const rng = () => 0.2;

  test('single file', () => {
    expect(buildSeasonOrder(['/a.ogg'], null, rng)).toEqual(['/a.ogg']);
  });

  test('with avoidFirst, first slot is not that url when more than one', () => {
    const o = buildSeasonOrder(['/a.ogg', '/b.ogg', '/c.ogg'], '/a.ogg', rng);
    expect(o[0]).not.toBe('/a.ogg');
  });
});

describe('nextFromOrder', () => {
  const rng = () => 0.4;

  test('second track differs from first for two files', () => {
    const urls = ['/x.ogg', '/y.ogg'];
    const a = nextFromOrder(urls, null, rng);
    const b = nextFromOrder(urls, a.state, rng);
    expect(a.nextUrl).not.toBe(b.nextUrl);
  });
});

describe('clampResumeTimeSec', () => {
  test('clamps to duration - epsilon', () => {
    expect(clampResumeTimeSec(200, 100, 0.05)).toBe(99.95);
    expect(clampResumeTimeSec(-1, 100, 0.05)).toBe(0);
    expect(clampResumeTimeSec(50, 0, 0.05)).toBe(0);
  });
});

describe('crossfadeVolumes', () => {
  test('t=0,1 at endpoints', () => {
    expect(crossfadeVolumes(0, 1, 0, 0, 1)).toEqual({ a: 1, b: 0 });
    expect(crossfadeVolumes(1, 1, 0, 0, 1)).toEqual({ a: 0, b: 1 });
  });
});

describe('normalizePathForMatch', () => {
  test('matches manifest path to encoded browser pathname', () => {
    const manifest = '/sounds/music/gameplay/winter/Winter Handpan Solo, Intricate & Complex.mp3';
    const browser = '/sounds/music/gameplay/winter/Winter%20Handpan%20Solo%2C%20Intricate%20%26%20Complex.mp3';
    expect(normalizePathForMatch(manifest)).toBe(normalizePathForMatch(browser));
  });
});
