import {
  buildAmbientVariantGroupMap,
  collectVariantUrlsForCatalogEntry,
  pickAmbientVariantUrl,
} from './ambientSoundVariants.mjs';

describe('collectVariantUrlsForCatalogEntry', () => {
  test('groups base and _vN files and sorts v1, v2 after base', () => {
    const disk = [
      'x_v2.ogg',
      'x.ogg',
      'x_v1.ogg',
      'unrelated.ogg',
    ];
    const urls = collectVariantUrlsForCatalogEntry('/sounds/ambient/x.ogg', disk);
    expect(urls).toEqual([
      '/sounds/ambient/x.ogg',
      '/sounds/ambient/x_v1.ogg',
      '/sounds/ambient/x_v2.ogg',
    ]);
  });

  test('only variant files (no base) still group', () => {
    const disk = ['y_v1.ogg', 'y_v3.ogg', 'y_v2.ogg'];
    const urls = collectVariantUrlsForCatalogEntry('/sounds/ambient/y.ogg', disk);
    expect(urls).toEqual([
      '/sounds/ambient/y_v1.ogg',
      '/sounds/ambient/y_v2.ogg',
      '/sounds/ambient/y_v3.ogg',
    ]);
  });
});

describe('buildAmbientVariantGroupMap', () => {
  test('builds one entry per catalog url with files on disk', () => {
    const groups = buildAmbientVariantGroupMap(
      ['/sounds/ambient/a.ogg', '/sounds/ambient/b.ogg'],
      ['a.ogg', 'a_v1.ogg', 'b.ogg'],
    );
    expect(groups['/sounds/ambient/a.ogg']).toEqual(['/sounds/ambient/a.ogg', '/sounds/ambient/a_v1.ogg']);
    expect(groups['/sounds/ambient/b.ogg']).toEqual(['/sounds/ambient/b.ogg']);
  });
});

describe('pickAmbientVariantUrl', () => {
  const groups = {
    '/sounds/ambient/x.ogg': [
      '/sounds/ambient/x.ogg',
      '/sounds/ambient/x_v1.ogg',
    ],
  };

  test('uses rng to pick from group', () => {
    const a = pickAmbientVariantUrl('/sounds/ambient/x.ogg', groups, () => 0);
    const b = pickAmbientVariantUrl('/sounds/ambient/x.ogg', groups, () => 0.99);
    expect(a).toBe('/sounds/ambient/x.ogg');
    expect(b).toBe('/sounds/ambient/x_v1.ogg');
  });

  test('unknown catalog url falls back to logical', () => {
    expect(pickAmbientVariantUrl('/sounds/ambient/missing.ogg', groups, () => 0.5))
      .toBe('/sounds/ambient/missing.ogg');
  });
});
