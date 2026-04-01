import {
  buildPlayerInventoryGridEntry,
  buildStockpileGridEntry,
  gridSlotSpriteFillStyle,
  gridSlotSpriteFillStyleForWidth,
} from './inventoryPanelEntries.mjs';
import { resolvePlantPartSpriteFrame } from './plantPartSpriteResolve.mjs';

describe('inventoryPanelEntries — same pipeline as App → GameModeChrome', () => {
  const harvestedRootStack = { itemId: 'daucus_carota:root:first_year', quantity: 1, unitWeightKg: 0.012 };

  it('buildPlayerInventoryGridEntry attaches part sprite offsets (not seedling 0,0)', () => {
    const entry = buildPlayerInventoryGridEntry(harvestedRootStack, 0);
    expect(entry.itemId).toBe('daucus_carota:root:first_year');
    expect(entry.spriteStyle).not.toBeNull();
    expect(entry.spriteStyle.backgroundPosition).toBe('-64px -64px');
    expect(entry.spriteStyle.backgroundSize).toBe('256px 256px');
    expect(entry.spriteStyle.backgroundImage).toContain('daucus_carota.png');
    expect(entry.spriteStyle.backgroundPosition).not.toBe('0px 0px');
  });

  it('buildStockpileGridEntry matches inventory mapping for the same stack', () => {
    const inv = buildPlayerInventoryGridEntry(harvestedRootStack, 0);
    const stock = buildStockpileGridEntry(harvestedRootStack, 0);
    expect(stock.spriteStyle).toEqual(inv.spriteStyle);
  });

  it('buildStockpileGridEntry includes spoilageProgress when decay metadata present', () => {
    const stock = buildStockpileGridEntry({
      itemId: 'earthworm',
      quantity: 2,
      decayDaysRemaining: 0.4,
    }, 0);
    expect(stock.decayDays).toBe(1);
    expect(stock.spoilageProgress).toBeCloseTo(0.6, 5);
  });

  it('catalog items with bogus unitWeightKg 0 fall back to item catalog grams (earthworm)', () => {
    const wormStack = { itemId: 'earthworm', quantity: 2, unitWeightKg: 0 };
    const entry = buildPlayerInventoryGridEntry(wormStack, 0);
    expect(entry.unitWeightKg).toBe(0.001);
    expect(entry.totalWeightKg).toBe(0.002);
  });

  it('buildPlayerInventoryGridEntry exposes dryness for tooltips and dried tint', () => {
    const entry = buildPlayerInventoryGridEntry({
      itemId: 'juglans_nigra:walnut_meat:raw',
      quantity: 1,
      dryness: 1,
      decayDaysRemaining: 4,
    }, 0);
    expect(entry.drynessPercent).toBe(100);
    expect(entry.isFullyDried).toBe(true);
  });

  it('buildPlayerInventoryGridEntry resolves decay_days from plant sub-stage for spoilage bar', () => {
    const entry = buildPlayerInventoryGridEntry({
      ...harvestedRootStack,
      decayDaysRemaining: 7,
    }, 0);
    expect(entry.decayDays).toBe(14);
    expect(entry.spoilageProgress).toBeCloseTo(0.5, 5);
  });

  it('buildPlayerInventoryGridEntry shows spoilage 0 and dryness 0 for dryable plant parts without stack fields', () => {
    const entry = buildPlayerInventoryGridEntry({
      itemId: 'juglans_nigra:walnut_meat:raw',
      quantity: 1,
    }, 0);
    expect(entry.canDry).toBe(true);
    expect(entry.spoilageProgress).toBeCloseTo(0, 5);
    expect(entry.drynessPercent).toBe(0);
  });

  it('gridSlotSpriteFillStyle (64px nominal) matches leaf atlas rect', () => {
    const sprite = resolvePlantPartSpriteFrame('daucus_carota:leaf:green');
    const style = gridSlotSpriteFillStyle(sprite);
    expect(style.backgroundPosition).toBe('-192px -64px');
    expect(style.backgroundSize).toBe('256px 256px');
  });

  it('gridSlotSpriteFillStyleForWidth scales with slot width', () => {
    const sprite = resolvePlantPartSpriteFrame('daucus_carota:leaf:green');
    const style = gridSlotSpriteFillStyleForWidth(sprite, 32);
    expect(style.backgroundPosition).toBe('-96px -32px');
    expect(style.backgroundSize).toBe('128px 128px');
  });
});
