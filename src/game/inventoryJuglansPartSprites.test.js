import { parsePlantPartItemId } from './plantPartDescriptors.mjs';
import { getPlantPartSpriteFrame, PLANT_SPRITE_CATALOG } from './plantSpriteCatalog.mjs';
import {
  buildPlayerInventoryGridEntry,
  buildStockpileGridEntry,
  gridSlotSpriteFillStyle,
  gridSlotSpriteFillStyleForWidth,
  gridSlotSpriteGeometry,
} from './inventoryPanelEntries.mjs';
import { resolvePlantPartSpriteFrame } from './plantPartSpriteResolve.mjs';
import { resolveInventoryItemSpriteFrame } from './inventoryItemSpriteResolve.mjs';

const JUGLANS_PART_ITEM_IDS = [
  'juglans_nigra:leaf:green',
  'juglans_nigra:branch:wood',
  'juglans_nigra:whole_fruit:green',
  'juglans_nigra:walnut_meat:raw',
];

/**
 * Fails the pipeline if: parse misses, resolve returns null, CSS strings contain NaN, or
 * geometry is non-finite (all match what InventorySlot + gridSlot* use in the full game).
 */
function expectValidInventorySpritePipeline(itemId) {
  const descriptor = parsePlantPartItemId(itemId);
  expect(descriptor).not.toBeNull();

  const resolved = resolvePlantPartSpriteFrame(itemId);
  expect(resolved).not.toBeNull();
  expect(resolved?.frame).toBeDefined();
  expect(Number.isFinite(resolved.frame.x)).toBe(true);
  expect(Number.isFinite(resolved.frame.w)).toBe(true);
  expect(resolved?.atlasWidth).toBeGreaterThan(0);
  expect(resolved?.atlasHeight).toBeGreaterThan(0);
  expect(typeof resolved?.imagePath).toBe('string');
  expect(resolved.imagePath.length).toBeGreaterThan(0);

  const g = gridSlotSpriteGeometry(resolved);
  expect(g).not.toBeNull();
  expect([g.fx, g.fy, g.fw, g.fh, g.atlasWidth, g.atlasHeight].every(Number.isFinite)).toBe(true);
  const style64 = gridSlotSpriteFillStyleForWidth(resolved, 64);
  const style40 = gridSlotSpriteFillStyleForWidth(resolved, 40);
  for (const style of [style64, style40]) {
    expect(style).not.toBeNull();
    const s = JSON.stringify(style);
    expect(s).not.toMatch(/NaN/);
    expect(s).not.toMatch(/undefined/);
    expect(style.backgroundImage).toMatch(/^url\(/);
  }

  const direct = getPlantPartSpriteFrame(
    descriptor.speciesId,
    descriptor.partName,
    descriptor.subStageId,
  );
  expect(direct).not.toBeNull();
}

describe('juglans_nigra (SVG/linear) plant-part inventory + stockpile pipeline', () => {
  it('catalog has SVG species with linear filter and part frames', () => {
    const j = PLANT_SPRITE_CATALOG.juglans_nigra;
    expect(j).toBeDefined();
    expect(j.textureFilter).toBe('linear');
    expect(j.partSubStageFrames).toBeDefined();
    expect(j.partSubStageFrames.leaf?.green).toBeDefined();
  });

  it('every representative harvest itemId parses, resolves, and produces finite CSS (live catalog)', () => {
    for (const itemId of JUGLANS_PART_ITEM_IDS) {
      expectValidInventorySpritePipeline(itemId);
    }
  });

  it('buildPlayerInventoryGridEntry and buildStockpileGridEntry return matching sprite + style for a walnut part', () => {
    const stack = { itemId: 'juglans_nigra:branch:wood', quantity: 1 };
    const inv = buildPlayerInventoryGridEntry(stack, 0);
    const sp = buildStockpileGridEntry(stack, 0);
    expect(inv.inventorySprite).not.toBeNull();
    expect(inv.spriteStyle).toEqual(gridSlotSpriteFillStyle(inv.inventorySprite));
    expect(sp.spriteStyle).toEqual(inv.spriteStyle);
  });

  it('trim: offset in 0-64 must scale by w/sourceW to match raster x (high-res atlasses)', () => {
    // Synthetic: 256px raster cell, 64 “design” source; 2px trim in source space = 8px in raster
    const sprite = {
      imagePath: '/plant_sprites/test.png',
      atlasWidth: 1280,
      atlasHeight: 1280,
      frame: {
        x: 768,
        y: 256,
        w: 256,
        h: 256,
        sourceW: 64,
        sourceH: 64,
        offsetX: 2,
        offsetY: 0,
      },
      textureFilter: 'linear',
    };
    const g = gridSlotSpriteGeometry(sprite);
    expect(g.fx).toBe(768 - 2 * 4);
    const style = gridSlotSpriteFillStyle(sprite);
    // 64px slot, 256px raster sub-rect → scale 0.25; position in px uses texture-space fx/fy
    const s = 64 / 256;
    expect(style.backgroundPosition).toBe(
      `-${(768 - 2 * 4) * s}px -${256 * s}px`,
    );
    expect(style.backgroundSize).toBe(`${1280 * s}px ${1280 * s}px`);
  });
});

describe('forage (bee) item ids map to crafting-intermediate atlas keys', () => {
  it('forage:bumble_honey and forage:bumble_larvae resolve via forage_ atlas keys', () => {
    const honey = resolveInventoryItemSpriteFrame('forage:bumble_honey');
    const larvae = resolveInventoryItemSpriteFrame('forage:bumble_larvae');
    expect(honey).not.toBeNull();
    expect(larvae).not.toBeNull();
    expect(honey?.imagePath).toMatch(/crafting_intermediates/);
    expect(larvae?.imagePath).toMatch(/crafting_intermediates/);
  });
});
