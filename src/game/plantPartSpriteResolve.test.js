import {
  getPlantPartSpriteFrame,
  getPlantSpriteFrame,
} from './plantSpriteCatalog.mjs';
import { parsePlantPartItemId } from './plantPartDescriptors.mjs';
import { resolvePlantPartSpriteFrame } from './plantPartSpriteResolve.mjs';

/** Atlas rects from `spritesheet_rd_final` / `plantSpriteCatalog.source.mjs` for daucus_carota. */
const DAUCUS_SEEDLING_RECT = { x: 0, y: 0, w: 64, h: 64 };
const DAUCUS_LEAF_GREEN_RECT = { x: 192, y: 64, w: 64, h: 64 };
const DAUCUS_ROOT_FIRST_YEAR_RECT = { x: 64, y: 64, w: 64, h: 64 };
const DAUCUS_ROOT_SECOND_YEAR_RECT = { x: 128, y: 64, w: 64, h: 64 };
const DAUCUS_STEM_GREEN_RECT = { x: 0, y: 128, w: 64, h: 64 };

function frameSummary(sprite) {
  if (!sprite) {
    return null;
  }
  const { x, y, w, h } = sprite.frame;
  return {
    imagePath: sprite.imagePath,
    x,
    y,
    w,
    h,
  };
}

describe('resolvePlantPartSpriteFrame — wild carrot harvest item IDs', () => {
  it('parses harvested stack ids that sim uses for root / leaf', () => {
    expect(parsePlantPartItemId('daucus_carota:root:first_year')).toMatchObject({
      speciesId: 'daucus_carota',
      partName: 'root',
      subStageId: 'first_year',
    });
    expect(parsePlantPartItemId('daucus_carota:leaf:green')).toMatchObject({
      speciesId: 'daucus_carota',
      partName: 'leaf',
      subStageId: 'green',
    });
  });

  it('catalog has dedicated part frames (not only life-stage tiles)', () => {
    const leaf = getPlantPartSpriteFrame('daucus_carota', 'leaf', 'green');
    const root = getPlantPartSpriteFrame('daucus_carota', 'root', 'first_year');
    expect(frameSummary(leaf)).toEqual(
      expect.objectContaining({
        imagePath: '/plant_sprites/daucus_carota.png',
        ...DAUCUS_LEAF_GREEN_RECT,
      }),
    );
    expect(frameSummary(root)).toEqual(
      expect.objectContaining({
        imagePath: '/plant_sprites/daucus_carota.png',
        ...DAUCUS_ROOT_FIRST_YEAR_RECT,
      }),
    );
  });

  it('resolves leaf and root stacks to part sprites, not the seedling (0,0)', () => {
    const seedling = getPlantSpriteFrame('daucus_carota', 'seedling');
    expect(frameSummary(seedling)).toEqual(
      expect.objectContaining({
        imagePath: '/plant_sprites/daucus_carota.png',
        ...DAUCUS_SEEDLING_RECT,
      }),
    );

    const leafSprite = resolvePlantPartSpriteFrame('daucus_carota:leaf:green');
    const rootSprite = resolvePlantPartSpriteFrame('daucus_carota:root:first_year');
    const rootSecond = resolvePlantPartSpriteFrame('daucus_carota:root:second_year');
    const stemSprite = resolvePlantPartSpriteFrame('daucus_carota:stem:green');

    expect(leafSprite).not.toBeNull();
    expect(rootSprite).not.toBeNull();
    expect(rootSecond).not.toBeNull();
    expect(stemSprite).not.toBeNull();

    const isSeedlingFrame = (f) => f.x === DAUCUS_SEEDLING_RECT.x && f.y === DAUCUS_SEEDLING_RECT.y;
    for (const sprite of [leafSprite, rootSprite, rootSecond, stemSprite]) {
      expect(isSeedlingFrame(sprite.frame)).toBe(false);
    }

    expect(frameSummary(leafSprite)).toEqual(expect.objectContaining(DAUCUS_LEAF_GREEN_RECT));
    expect(frameSummary(rootSprite)).toEqual(expect.objectContaining(DAUCUS_ROOT_FIRST_YEAR_RECT));
    expect(frameSummary(rootSecond)).toEqual(expect.objectContaining(DAUCUS_ROOT_SECOND_YEAR_RECT));
    expect(frameSummary(stemSprite)).toEqual(expect.objectContaining(DAUCUS_STEM_GREEN_RECT));
  });
});
